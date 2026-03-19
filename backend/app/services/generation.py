"""
Logique de génération d'épreuves.

Architecture en deux phases séparées :

  Phase 1 — Planification (logique pure, sans DB) :
    build_journee_plan(journee_type) → List[PeriodePlan]
    Construit le plan complet (blocs résolus, paramètres effectifs) sans toucher
    à la base de données. Utilisable pour prévisualiser une génération.

  Phase 2 — Exécution (écritures DB) :
    apply_journee_type(db, planning_id, journee_type, target_date)
    Applique le plan en base : upsert des demi-journées + génération des épreuves.

Modèle rotatif N² (generate_in_range) :
  Pour N matières, génère exactement N² créneaux par bloc.
  Chaque créneau contient une épreuve par matière (N épreuves simultanées).
  Le modèle d'inscription assigne à un candidat k les épreuves aux créneaux
  k, k+N, k+2N, ... (offset=N) — soit 1 épreuve par matière à un horaire différent.
  Exemple N=3 : 9 créneaux, 9 candidats, offset=3.
    candidat 0 → Maths@slot0, Anglais@slot3, ESH@slot6
    candidat 1 → Maths@slot1, Anglais@slot4, ESH@slot7
    candidat 4 → Maths@slot4, Anglais@slot7, ESH@slot1  (wrap autour de N²)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, date, time, timedelta
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.journee_type import JourneeType
from app.models.journee_type_bloc import JourneeTypeBloc
from app.schemas.generation import GenerateEpreuvesIn, SkipRange

# ── Constantes ────────────────────────────────────────────────────────────────

HEURE_PIVOT_MIDI = time(12, 0)


# ── Dataclasses de planification ──────────────────────────────────────────────
# Ces classes représentent le "plan" d'une génération.
# Elles sont pures (aucune dépendance SQLAlchemy) et donc testables et
# prévisualisables indépendamment de la base de données.

@dataclass
class BlocParams:
    """
    Paramètres effectifs d'un bloc GENERATION après résolution des valeurs par
    défaut du gabarit (journée type).

    Toutes les valeurs sont garanties non-nulles : si le bloc ne surcharge pas
    un paramètre, c'est la valeur par défaut du JourneeType qui s'applique.
    """
    heure_debut: time
    heure_fin: time
    matieres: List[str]
    duree_minutes: int
    pause_minutes: int
    preparation_minutes: int
    salles_par_matiere: int = 1

    @classmethod
    def from_bloc(cls, bloc: JourneeTypeBloc, jt: JourneeType) -> "BlocParams":
        """
        Construit un BlocParams en appliquant les surcharges du bloc
        et les valeurs par défaut du gabarit.
        """
        return cls(
            heure_debut=bloc.heure_debut,
            heure_fin=bloc.heure_fin,
            matieres=bloc.matieres,
            duree_minutes=bloc.duree_minutes if bloc.duree_minutes is not None
                          else jt.duree_defaut_minutes,
            pause_minutes=bloc.pause_minutes if bloc.pause_minutes is not None
                          else jt.pause_defaut_minutes,
            preparation_minutes=bloc.preparation_minutes if bloc.preparation_minutes is not None
                                else jt.preparation_defaut_minutes,
            salles_par_matiere=bloc.salles_par_matiere,
        )


@dataclass
class PeriodePlan:
    """
    Plan de génération pour une demi-journée (MATIN ou APRES_MIDI).

    Contient tous les blocs GENERATION résolus (BlocParams) pour cette période.
    Une PeriodePlan n'existe que si la période a au moins un bloc GENERATION.
    """
    type_dj: str                          # "MATIN" | "APRES_MIDI"
    heure_debut: time                     # premier bloc de la période (tous types)
    heure_fin: time                       # dernier bloc de la période (tous types)
    blocs: List[BlocParams] = field(default_factory=list)


# ── Phase 1 : Planification (pure, sans DB) ───────────────────────────────────

def _split_blocs_by_periode(
    blocs: List[JourneeTypeBloc],
) -> dict[str, List[JourneeTypeBloc]]:
    """
    Trie les blocs par heure de début et les répartit en deux groupes :
      - MATIN      : blocs dont heure_debut < 12h00
      - APRES_MIDI : blocs dont heure_debut >= 12h00
    """
    sorted_blocs = sorted(blocs, key=lambda b: b.heure_debut)
    return {
        "MATIN":      [b for b in sorted_blocs if b.heure_debut < HEURE_PIVOT_MIDI],
        "APRES_MIDI": [b for b in sorted_blocs if b.heure_debut >= HEURE_PIVOT_MIDI],
    }


def build_journee_plan(journee_type: JourneeType) -> List[PeriodePlan]:
    """
    Construit le plan de génération complet d'un gabarit de journée.

    Retourne une liste de PeriodePlan (0, 1 ou 2 éléments) :
      - Une PeriodePlan par période (MATIN / APRES_MIDI) ayant au moins
        un bloc GENERATION.
      - Les périodes sans bloc GENERATION sont ignorées.

    Cette fonction est pure (aucun accès base de données) : elle peut être
    appelée pour prévisualiser une génération avant de la persister.
    """
    groupes = _split_blocs_by_periode(journee_type.blocs)
    plans: List[PeriodePlan] = []

    for type_dj, blocs_periode in groupes.items():
        blocs_gen = [b for b in blocs_periode if b.type_bloc == "GENERATION"]
        if not blocs_gen:
            continue

        plans.append(PeriodePlan(
            type_dj=type_dj,
            heure_debut=blocs_periode[0].heure_debut,
            heure_fin=blocs_periode[-1].heure_fin,
            blocs=[BlocParams.from_bloc(b, journee_type) for b in blocs_gen],
        ))

    return plans


# ── Moteur de slots (bas niveau) ──────────────────────────────────────────────

def _time_to_dt(t: time) -> datetime:
    """Convertit un time en datetime (date arbitraire) pour les calculs d'intervalles."""
    return datetime.combine(date(2000, 1, 1), t)


def _overlaps_skip(
    start: time,
    end: time,
    skip_ranges: List[SkipRange],
) -> Optional[time]:
    """
    Retourne la fin du premier skip_range qui chevauche [start, end[,
    ou None si aucun chevauchement.
    """
    for sr in skip_ranges:
        if start < sr.end and end > sr.start:
            return sr.end
    return None


def generate_in_range(
    db: Session,
    demi_journee_id: int,
    debut: time,
    fin: time,
    matieres: List[str],
    duree_minutes: int,
    pause_minutes: int,
    statut_initial: str,
    preparation_minutes: int = 0,
    skip_ranges: Optional[List[SkipRange]] = None,
    matiere_offset: int = 0,
    salles_par_matiere: int = 1,
) -> int:
    """
    Génère et persiste les épreuves dans la plage [debut, fin[.

    Modèle rotatif N² : pour N matières, génère exactement N² créneaux horaires.
    Cela produit N² rotations possibles avec un offset=N entre matières, permettant
    d'accueillir N² × salles_par_matiere candidats par demi-journée.
    Exemple : 3 matières, 7 salles/matière → 9 créneaux × 7 = 63 candidats.

    Retourne le nombre d'épreuves créées.
    """
    if skip_ranges is None:
        skip_ranges = []

    n_matieres = len(matieres)
    n_slots_max = n_matieres * n_matieres  # N² créneaux pour le modèle rotatif

    # Les créneaux avancent de duree_minutes (préparation concurrente).
    # heure_debut = deb_exam = t + prep (ce que voit le candidat)
    # heure_fin   = fin_exam = t + prep + duree
    # t représente le deb_prépa du créneau courant.
    prep_delta = timedelta(minutes=preparation_minutes)
    slot_advance = timedelta(minutes=duree_minutes)   # avance du deb_prépa d'un créneau à l'autre
    pause = timedelta(minutes=pause_minutes)

    t = _time_to_dt(debut)
    fin_dt = _time_to_dt(fin)
    count = 0
    slots_placed = 0

    while slots_placed < n_slots_max and t + prep_delta + slot_advance <= fin_dt:
        exam_start = t + prep_delta
        exam_end = exam_start + slot_advance
        skip_fin = _overlaps_skip(exam_start.time(), exam_end.time(), skip_ranges)

        if skip_fin is not None:
            t = _time_to_dt(skip_fin) - prep_delta
            continue

        for matiere in matieres:
            for _ in range(salles_par_matiere):
                db.add(Epreuve(
                    demi_journee_id=demi_journee_id,
                    matiere=matiere,
                    heure_debut=exam_start.time(),
                    heure_fin=exam_end.time(),
                    statut=statut_initial,
                    preparation_minutes=preparation_minutes if preparation_minutes > 0 else None,
                ))
        count += n_matieres * salles_par_matiere
        slots_placed += 1
        t = t + slot_advance + pause

    return count


# ── Phase 2 : Exécution (écritures DB) ───────────────────────────────────────

def _upsert_demi_journee(
    db: Session,
    planning_id: int,
    target_date: date,
    plan: PeriodePlan,
) -> Tuple[DemiJournee, bool]:
    """
    Crée ou met à jour la DemiJournee correspondant à une PeriodePlan.

    Retourne (demi_journee, is_new) :
      - is_new=True si la demi-journée vient d'être créée
      - is_new=False si elle existait déjà (horaires mis à jour)
    """
    dj = (
        db.query(DemiJournee)
        .filter_by(planning_id=planning_id, date=target_date, type=plan.type_dj)
        .first()
    )
    if dj is None:
        dj = DemiJournee(
            planning_id=planning_id,
            date=target_date,
            type=plan.type_dj,
            heure_debut=plan.heure_debut,
            heure_fin=plan.heure_fin,
        )
        db.add(dj)
        db.flush()
        return dj, True

    dj.heure_debut = plan.heure_debut
    dj.heure_fin = plan.heure_fin
    db.flush()
    return dj, False


def _apply_periode_plan(
    db: Session,
    dj: DemiJournee,
    plan: PeriodePlan,
    statut_initial: str,
) -> int:
    """
    Supprime les épreuves existantes de la demi-journée et régénère
    les épreuves à partir des blocs du plan.

    La rotation des matières est continue entre les blocs (matiere_offset).

    Retourne le nombre d'épreuves créées.
    """
    db.query(Epreuve).filter(Epreuve.demi_journee_id == dj.id).delete()

    matiere_offset = 0
    total = 0

    for bloc in plan.blocs:
        n = generate_in_range(
            db=db,
            demi_journee_id=dj.id,
            debut=bloc.heure_debut,
            fin=bloc.heure_fin,
            matieres=bloc.matieres,
            duree_minutes=bloc.duree_minutes,
            pause_minutes=bloc.pause_minutes,
            preparation_minutes=bloc.preparation_minutes,
            statut_initial=statut_initial,
            matiere_offset=matiere_offset,
            salles_par_matiere=bloc.salles_par_matiere,
        )
        total += n
        matiere_offset += n

    return total


# ── API publique ──────────────────────────────────────────────────────────────

def generate_for_demi_journee(
    db: Session,
    demi_journee: DemiJournee,
    params: GenerateEpreuvesIn,
) -> int:
    """
    (Re-)génère les épreuves pour une demi-journée à partir de paramètres manuels.
    Supprime les épreuves existantes avant de générer.

    Retourne le nombre d'épreuves créées.
    """
    matieres = params.resolved_matieres()
    db.query(Epreuve).filter(Epreuve.demi_journee_id == demi_journee.id).delete()

    count = generate_in_range(
        db=db,
        demi_journee_id=demi_journee.id,
        debut=demi_journee.heure_debut,
        fin=demi_journee.heure_fin,
        matieres=matieres,
        duree_minutes=params.duree_minutes,
        pause_minutes=params.pause_minutes,
        statut_initial=params.statut_initial,
        skip_ranges=params.skip_ranges,
    )
    db.commit()
    return count


def apply_journee_type(
    db: Session,
    planning_id: int,
    journee_type: JourneeType,
    target_date: date,
) -> dict:
    """
    Applique un gabarit de journée type à une date d'un planning.

    Orchestration en trois étapes :
      1. Planification  — build_journee_plan() construit le plan sans DB
      2. Upsert         — crée ou met à jour les DemiJournee en base
      3. Génération     — supprime et recrée les épreuves selon le plan

    Retourne {"demi_journees_created": int, "epreuves_created": int}.
    """
    plans = build_journee_plan(journee_type)

    dj_created = 0
    ep_created = 0

    for plan in plans:
        dj, is_new = _upsert_demi_journee(db, planning_id, target_date, plan)
        if is_new:
            dj_created += 1
        ep_created += _apply_periode_plan(db, dj, plan, journee_type.statut_initial)

    db.commit()
    return {"demi_journees_created": dj_created, "epreuves_created": ep_created}
