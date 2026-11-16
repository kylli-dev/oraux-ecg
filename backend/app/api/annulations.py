"""Annulation des grosses actions de l'admin (24 h) — voir services/annulations.py."""
from datetime import timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.planning import Planning
from app.services.annulations import AnnulationImpossible, annulables, annuler
from app.services.monitoring import signaler_detail

router = APIRouter(
    prefix="/admin/annulations",
    tags=["annulations"],
    dependencies=[Depends(require_admin)],
)


class AnnulationOut(BaseModel):
    id: int
    date: str  # ISO UTC
    libelle: str
    planning_id: int
    planning_nom: Optional[str] = None
    admin_nom: Optional[str] = None


@router.get("/", response_model=List[AnnulationOut])
def lister(limite: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Actions des dernières 24 h encore annulables, les plus récentes d'abord."""
    lignes = annulables(db, limite)
    noms = {p.id: p.nom for p in db.query(Planning).filter(Planning.id.in_({a.planning_id for a in lignes})).all()} if lignes else {}
    return [
        AnnulationOut(
            id=a.id, date=a.created_at.replace(tzinfo=timezone.utc).isoformat(), libelle=a.libelle,
            planning_id=a.planning_id, planning_nom=noms.get(a.planning_id), admin_nom=a.admin_nom,
        )
        for a in lignes
    ]


@router.post("/{annulation_id}/annuler")
def annuler_action(annulation_id: int, request: Request, db: Session = Depends(get_db)):
    try:
        message = annuler(db, annulation_id)
    except AnnulationImpossible as e:
        raise HTTPException(status_code=409, detail=str(e))
    signaler_detail(request, f"Annulation : {message}")
    return {"message": message}
