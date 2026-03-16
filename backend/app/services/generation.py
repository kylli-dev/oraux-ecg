"""
Logique de génération d'épreuves.

Algorithme principal :
  Pour une plage horaire [heure_debut, heure_fin) et une liste de matières,
  on place des créneaux de duree_minutes séparés par pause_minutes,
  en rotation sur les matières.
"""
from datetime import datetime, date, time, timedelta
from typing import List

from sqlalchemy.orm import Session

from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.journee_type import JourneeType
from app.schemas.generation import GenerateEpreuvesIn, SkipRange


def _time_to_dt(t: time) -> datetime:
    """Convertit un time en datetime (date arbitraire) pour les calculs."""
    return datetime.combine(date(2000, 1, 1), t)


def _overlaps_skip(start: time, end: time, skip_ranges: List[SkipRange]) -> time | None:
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
    skip_ranges: List[SkipRange] | None = None,
    matiere_offset: int = 0,
) -> int:
    """
    Génère les épreuves dans la plage [debut, fin[ pour une demi-journée.

    Retourne le nombre d'épreuves créées.
    """
    if skip_ranges is None:
        skip_ranges = []

    duree = timedelta(minutes=duree_minutes)
    pause = timedelta(minutes=pause_minutes)

    t = _time_to_dt(debut)
    fin_dt = _time_to_dt(fin)

    idx = matiere_offset
    count = 0

    while t + duree <= fin_dt:
        slot_end = t + duree
        skip_fin = _overlaps_skip(t.time(), slot_end.time(), skip_ranges)

        if skip_fin is not None:
            # Avancer jusqu'à la fin du skip range
            t = _time_to_dt(skip_fin)
            continue

        matiere = matieres[idx % len(matieres)]
        epreuve = Epreuve(
            demi_journee_id=demi_journee_id,
            matiere=matiere,
            heure_debut=t.time(),
            heure_fin=slot_end.time(),
            statut=statut_initial,
        )
        db.add(epreuve)
        idx += 1
        count += 1
        t = slot_end + pause

    return count


def generate_for_demi_journee(
    db: Session,
    demi_journee: DemiJournee,
    params: GenerateEpreuvesIn,
) -> int:
    """
    (Re-)génère les épreuves pour une demi-journée à partir des paramètres fournis.
    Supprime les épreuves existantes avant de générer.

    Retourne le nombre d'épreuves créées.
    """
    matieres = params.resolved_matieres()

    # Suppression des épreuves existantes
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

    - Crée ou met à jour les DemiJournee MATIN / APRES_MIDI selon les blocs.
    - Ne crée PAS de demi-journée pour les dates qui n'ont que des blocs PAUSE.
    - Génère les épreuves pour chaque bloc GENERATION.

    Retourne un dict {"demi_journees_created": int, "epreuves_created": int}.
    """
    MIDI = time(12, 0)

    blocs = sorted(journee_type.blocs, key=lambda b: b.heure_debut)

    blocs_matin = [b for b in blocs if b.heure_debut < MIDI]
    blocs_aprem = [b for b in blocs if b.heure_debut >= MIDI]

    dj_created = 0
    ep_created = 0

    for groupe, type_dj in [(blocs_matin, "MATIN"), (blocs_aprem, "APRES_MIDI")]:
        blocs_gen = [b for b in groupe if b.type_bloc == "GENERATION"]
        if not blocs_gen:
            # Pas de bloc GENERATION → pas de demi-journée
            continue

        heure_debut = groupe[0].heure_debut
        heure_fin = groupe[-1].heure_fin

        # Upsert demi-journée
        dj = (
            db.query(DemiJournee)
            .filter_by(planning_id=planning_id, date=target_date, type=type_dj)
            .first()
        )
        if dj is None:
            dj = DemiJournee(
                planning_id=planning_id,
                date=target_date,
                type=type_dj,
                heure_debut=heure_debut,
                heure_fin=heure_fin,
            )
            db.add(dj)
            db.flush()
            dj_created += 1
        else:
            dj.heure_debut = heure_debut
            dj.heure_fin = heure_fin
            db.flush()

        # Supprimer les épreuves existantes pour cette demi-journée
        db.query(Epreuve).filter(Epreuve.demi_journee_id == dj.id).delete()

        # Générer les épreuves pour chaque bloc GENERATION
        matiere_offset = 0
        for bloc in blocs_gen:
            duree = bloc.duree_minutes or journee_type.duree_defaut_minutes
            pause = bloc.pause_minutes if bloc.pause_minutes is not None else journee_type.pause_defaut_minutes
            matieres = bloc.matieres  # property qui décode le JSON

            n = generate_in_range(
                db=db,
                demi_journee_id=dj.id,
                debut=bloc.heure_debut,
                fin=bloc.heure_fin,
                matieres=matieres,
                duree_minutes=duree,
                pause_minutes=pause,
                statut_initial=journee_type.statut_initial,
                matiere_offset=matiere_offset,
            )
            ep_created += n
            matiere_offset += n

    db.commit()
    return {"demi_journees_created": dj_created, "epreuves_created": ep_created}
