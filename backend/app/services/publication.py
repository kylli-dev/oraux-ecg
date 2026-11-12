"""
Publication des épreuves aux candidats : une épreuve LIBRE n'est proposée aux candidats
(portail : triplets, inscription, liste d'attente) que si elle a une salle, un examinateur
et un surveillant. L'admin, lui, peut toujours inscrire un candidat sur n'importe quel créneau.
"""
from __future__ import annotations

from typing import List

from sqlalchemy import and_, or_

from app.models.epreuve import Epreuve


def manques_publication(e) -> List[str]:
    """Ce qui manque à une épreuve pour être proposée aux candidats (vide = publiable)."""
    manques = []
    if not e.salle_id:
        manques.append("salle")
    if not (e.examinateur_id or e.examinateur2_id):
        manques.append("examinateur")
    if not (e.surveillant_id or e.surveillant2_id):
        manques.append("surveillant")
    return manques


def epreuve_publiable(e) -> bool:
    return not manques_publication(e)


def condition_publiable():
    """Même règle que epreuve_publiable, en condition SQL (filtre de requête)."""
    return and_(
        Epreuve.salle_id.isnot(None),
        or_(Epreuve.examinateur_id.isnot(None), Epreuve.examinateur2_id.isnot(None)),
        or_(Epreuve.surveillant_id.isnot(None), Epreuve.surveillant2_id.isnot(None)),
    )
