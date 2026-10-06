"""
Cohérence des inscriptions quand des épreuves disparaissent.

Supprimer une journée, une demi-journée, une épreuve ou régénérer une demi-journée efface
des épreuves ; les liens InscriptionEpreuve correspondants disparaissent avec elles (FK en
cascade), mais l'Inscription elle-même restait ACTIVE. Un candidat dont TOUTES les épreuves
ont été supprimées gardait donc une inscription active vide, qui faisait planter sa fiche
admin (500) et la page « Mes créneaux » de son portail.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.inscription import Inscription, InscriptionEpreuve


def epreuves_valides(insc: Inscription) -> list:
    """Épreuves encore existantes d'une inscription (ignore les liens vers une épreuve supprimée)."""
    return [ie.epreuve for ie in insc.epreuves if ie.epreuve is not None]


def annuler_inscriptions_orphelines(db: Session) -> int:
    """
    Annule les inscriptions ACTIVE qui n'ont plus aucune épreuve, et retire les liens
    pointant vers une épreuve supprimée (cas d'une base sans cascade FK, ex. SQLite).
    Le candidat concerné repasse « non inscrit ». Retourne le nombre d'inscriptions annulées.
    Ne fait pas de commit : à l'appelant de valider la transaction.
    """
    db.flush()
    db.expire_all()
    annulees = 0
    for insc in db.query(Inscription).filter_by(statut="ACTIVE").all():
        orphelins = [ie for ie in insc.epreuves if ie.epreuve is None]
        for ie in orphelins:
            db.delete(ie)
        if len(insc.epreuves) - len(orphelins) == 0:
            insc.statut = "ANNULEE"
            insc.cancelled_at = datetime.now(timezone.utc).replace(tzinfo=None)  # UTC naïf, comme ailleurs
            if insc.candidat is not None and insc.candidat.statut == "INSCRIT":
                insc.candidat.statut = "IMPORTE"
            annulees += 1
    return annulees
