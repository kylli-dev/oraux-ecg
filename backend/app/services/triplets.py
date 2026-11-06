"""
Composition des triplets d'une journée : quelles épreuves un candidat passe ensemble.

Une seule source pour le portail candidat, la Vue triplets et l'inscription par l'admin,
qui calculaient chacun les triplets à leur façon (et ne tombaient donc pas d'accord).

  - Journée générée depuis une journée type : chaque épreuve porte le numéro de triplet de
    la matrice (Epreuve.triplet_num, déplacements manuels compris). Les épreuves de même
    numéro forment le triplet ; les salles en parallèle d'une même case partagent le numéro.
  - Sinon (journées générées avant, ou à la main) : rotation circulaire sur tous les
    horaires de la journée, avec l'écart minimal viable entre deux passages (portail) — ou,
    pour la Vue triplets et l'inscription par l'admin, l'écart historique total ÷ matières,
    inchangé pour ne pas défaire les préréservations déjà faites sur ces journées.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import time
from typing import Dict, List, Optional, Tuple

# Marge minimale entre la fin d'un passage et le début de préparation du suivant, pour un
# même candidat (le temps de changer de salle) — DOIT rester synchronisée avec
# MARGIN_TRANSITION_MINUTES côté frontend (admin/page.tsx et InterfaceAdminENSAEPlanning.jsx).
MARGIN_TRANSITION_MINUTES = 30

Case = Tuple[str, time]  # (matière, heure de début d'examen)


@dataclass
class GroupeTriplet:
    """Un triplet possible : pour chaque case (matière, heure), les épreuves en parallèle."""
    cle: str                       # identifiant stable dans la journée : "T5" ou "R3"
    numero: Optional[int]          # numéro de la matrice (5 pour T5), None en rotation
    heure_ref: time                # heure qui représente le triplet (tri, compatibilité)
    cases: Dict[Case, list]        # liste vide = aucune épreuve à cet horaire

    def sans_matiere(self, matiere_upper: str) -> "GroupeTriplet":
        return GroupeTriplet(
            self.cle, self.numero, self.heure_ref,
            {c: eps for c, eps in self.cases.items() if c[0].upper() != matiere_upper},
        )

    def matieres_upper(self) -> set:
        return {m.upper() for m, _ in self.cases}


def rotation_offset(all_day_epreuves: list, all_slots: list, n_rooms: int) -> int:
    """
    Écart (en nombre de créneaux) entre deux passages d'un même candidat dans la rotation
    circulaire (k + i × offset) : le plus petit pour lequel la PRÉPARATION du passage suivant
    ne commence jamais avant MARGIN_TRANSITION_MINUTES après la fin de l'examen précédent.
    Calculé sur les horaires réels des épreuves, donc valable avec des durées différentes ou
    une pause déjeuner. Retombe sur total_slots // n_rooms si aucun écart plus petit n'est sûr.
    """
    total_slots = len(all_slots)
    if n_rooms <= 0 or total_slots == 0:
        return 1

    def to_min(t) -> int:
        return t.hour * 60 + t.minute

    fin_max_par_slot: dict = {}
    deb_prepa_min_par_slot: dict = {}
    for e in all_day_epreuves:
        fin_min = to_min(e.heure_fin)
        if fin_min > fin_max_par_slot.get(e.heure_debut, -1):
            fin_max_par_slot[e.heure_debut] = fin_min
        deb_prepa = to_min(e.heure_debut) - (e.preparation_minutes or 0)
        if deb_prepa < deb_prepa_min_par_slot.get(e.heure_debut, deb_prepa + 1):
            deb_prepa_min_par_slot[e.heure_debut] = deb_prepa

    fallback = total_slots // n_rooms or 1
    for o in range(1, total_slots):
        if all(
            fin_max_par_slot.get(all_slots[idx], to_min(all_slots[idx])) + MARGIN_TRANSITION_MINUTES
            <= deb_prepa_min_par_slot.get(all_slots[idx + o], to_min(all_slots[idx + o]))
            for idx in range(total_slots - o)
        ):
            return o
    return fallback


def _groupes_rotation(epreuves: list, ecart_historique: bool = False) -> List[GroupeTriplet]:
    all_slots = sorted({e.heure_debut for e in epreuves})
    matieres = sorted({e.matiere for e in epreuves})
    if not all_slots or not matieres:
        return []
    if ecart_historique:
        offset = len(all_slots) // len(matieres) or 1
    else:
        offset = rotation_offset(epreuves, all_slots, len(matieres))
    toutes: dict = defaultdict(list)
    for e in epreuves:
        toutes[(e.matiere, e.heure_debut)].append(e)
    total = len(all_slots)
    groupes = []
    for k in range(total):
        cases = {}
        for i, m in enumerate(matieres):
            h = all_slots[(k + i * offset) % total]
            cases[(m, h)] = toutes.get((m, h), [])
        groupes.append(GroupeTriplet(f"R{k}", None, all_slots[k], cases))
    return groupes


def groupes_du_jour(epreuves: list, ecart_historique: bool = False) -> List[GroupeTriplet]:
    """
    Triplets possibles d'une journée (toutes demi-journées confondues), quel que soit le
    statut des épreuves : à l'appelant de ne garder que les épreuves disponibles.
    ecart_historique : rotation à l'écart total ÷ matières (vues admin), voir plus haut.
    """
    numerotees = [e for e in epreuves if e.triplet_num is not None]
    if not numerotees:
        return _groupes_rotation(epreuves, ecart_historique)

    par_num: dict = defaultdict(lambda: defaultdict(list))
    proprietaire: dict = {}
    for e in numerotees:
        case = (e.matiere, e.heure_debut)
        par_num[e.triplet_num][case].append(e)
        proprietaire[case] = min(proprietaire.get(case, e.triplet_num), e.triplet_num)

    # Épreuve sans numéro dans une journée numérotée (ajoutée à la main) : même case qu'une
    # épreuve numérotée → salle en parallèle de ce triplet ; sinon → rotation entre elles
    restes = []
    for e in epreuves:
        if e.triplet_num is not None:
            continue
        num = proprietaire.get((e.matiere, e.heure_debut))
        if num is None:
            restes.append(e)
        else:
            par_num[num][(e.matiere, e.heure_debut)].append(e)

    groupes = []
    for num in sorted(par_num):
        cases = dict(sorted(par_num[num].items(), key=lambda kv: (kv[0][1], kv[0][0])))
        groupes.append(GroupeTriplet(f"T{num}", num, min(h for _, h in cases), cases))
    return groupes + _groupes_rotation(restes, ecart_historique)


def groupes_pour_profil(epreuves: list, profil: str, matiere_exclue: Optional[str], ecart_historique: bool = False) -> List[GroupeTriplet]:
    """
    Triplets proposés à un candidat de profil donné (HGG / ESH) : sans la matière de l'autre
    profil. En rotation, on retire cette matière avant de calculer (comportement historique).
    Avec la matrice, un triplet de l'autre profil est écarté en entier — sauf s'il contient
    aussi la matière du candidat (bloc commun aux deux), dont on retire alors l'autre matière.
    """
    if not matiere_exclue:
        return groupes_du_jour(epreuves, ecart_historique)
    if not any(e.triplet_num is not None for e in epreuves):
        return groupes_du_jour([e for e in epreuves if e.matiere.upper() != matiere_exclue], ecart_historique)
    result = []
    for g in groupes_du_jour(epreuves, ecart_historique):
        matieres = g.matieres_upper()
        if matiere_exclue in matieres and profil not in matieres:
            continue
        g = g.sans_matiere(matiere_exclue)
        if g.cases:
            result.append(g)
    return result


def choisir_epreuves(groupe: GroupeTriplet, statuts: tuple) -> Optional[list]:
    """Une épreuve disponible par case (la première des salles en parallèle), ou None."""
    choisies = []
    for eps in groupe.cases.values():
        dispo = [e for e in eps if e.statut in statuts]
        if not dispo:
            return None
        choisies.append(dispo[0])
    return choisies or None
