"""
Détection des conflits établissement :
Un conflit existe quand un candidat et un examinateur affectés à la même épreuve
sont issus du même lycée (même code UAI non nul).
"""
from datetime import date as Date
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.epreuve import Epreuve
from app.models.candidat import Candidat
from app.models.examinateur import Examinateur
from app.models.demi_journee import DemiJournee

router = APIRouter(
    prefix="/admin/conflits",
    tags=["conflits"],
    dependencies=[Depends(require_admin)],
)


class ConflitOut(BaseModel):
    epreuve_id: int
    date: Date
    matiere: str
    heure_debut: str
    heure_fin: str
    candidat_id: int
    candidat_nom: str
    candidat_prenom: str
    examinateur_id: int
    examinateur_nom: str
    examinateur_prenom: str
    code_uai: str


def detect_conflits(db: Session, planning_id: Optional[int] = None) -> List[ConflitOut]:
    """Retourne la liste des conflits établissement détectés."""
    query = (
        db.query(Epreuve, Candidat, Examinateur, DemiJournee)
        .join(Candidat, Epreuve.candidat_id == Candidat.id)
        .join(Examinateur, Epreuve.examinateur_id == Examinateur.id)
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(
            Candidat.code_uai.isnot(None),
            Examinateur.code_uai.isnot(None),
            Candidat.code_uai == Examinateur.code_uai,
        )
    )
    if planning_id:
        query = query.filter(DemiJournee.planning_id == planning_id)

    conflits = []
    for epreuve, candidat, examinateur, dj in query.all():
        conflits.append(
            ConflitOut(
                epreuve_id=epreuve.id,
                date=dj.date,
                matiere=epreuve.matiere,
                heure_debut=str(epreuve.heure_debut)[:5],
                heure_fin=str(epreuve.heure_fin)[:5],
                candidat_id=candidat.id,
                candidat_nom=candidat.nom,
                candidat_prenom=candidat.prenom,
                examinateur_id=examinateur.id,
                examinateur_nom=examinateur.nom,
                examinateur_prenom=examinateur.prenom,
                code_uai=candidat.code_uai,
            )
        )
    conflits.sort(key=lambda c: (c.date, c.heure_debut))
    return conflits


@router.get("/", response_model=List[ConflitOut])
def get_conflits(
    planning_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Retourne tous les conflits établissement actifs.
    Un conflit = épreuve où candidat et examinateur ont le même code UAI.
    Filtrable par planning_id.
    """
    return detect_conflits(db, planning_id)


@router.get("/count")
def count_conflits(
    planning_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retourne uniquement le nombre de conflits (pour badge dans l'UI)."""
    return {"count": len(detect_conflits(db, planning_id))}
