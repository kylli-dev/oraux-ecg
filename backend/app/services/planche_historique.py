"""Enregistrement des événements dans le journal des planches (ajout seul)."""
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.planche_historique import PlancheHistorique


def journaliser_planche(
    db: Session,
    action: str,
    ep,
    planche=None,
    ancienne_planche_nom: Optional[str] = None,
) -> None:
    """
    Ajoute une ligne au journal pour l'épreuve `ep` (et la planche concernée), en figeant le
    contexte actuel : candidat, examinateur, date/heure de l'épreuve. Ne fait pas de commit.
    """
    from app.models.candidat import Candidat
    from app.models.demi_journee import DemiJournee
    from app.models.examinateur import Examinateur

    dj = db.get(DemiJournee, ep.demi_journee_id) if ep is not None else None
    cand = db.get(Candidat, ep.candidat_id) if ep is not None and ep.candidat_id else None
    ex = db.get(Examinateur, ep.examinateur_id) if ep is not None and ep.examinateur_id else None
    db.add(PlancheHistorique(
        action=action,
        epreuve_id=ep.id if ep is not None else None,
        planche_id=planche.id if planche is not None else None,
        planning_id=dj.planning_id if dj else None,
        planche_nom=planche.nom if planche is not None else None,
        ancienne_planche_nom=ancienne_planche_nom,
        matiere=ep.matiere if ep is not None else None,
        date_epreuve=dj.date if dj else None,
        heure_debut=str(ep.heure_debut)[:5] if ep is not None else None,
        candidat_id=cand.id if cand else None,
        candidat_nom=f"{cand.nom} {cand.prenom or ''}".strip() if cand else None,
        examinateur_nom=f"{ex.nom} {ex.prenom or ''}".strip() if ex else None,
    ))
