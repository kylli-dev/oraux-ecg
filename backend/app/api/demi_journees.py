from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.demi_journee import DemiJournee
from app.schemas.demi_journee import DemiJourneeCreate, DemiJourneeOut, DemiJourneeUpdate
from app.schemas.generation import GenerateEpreuvesIn
from app.services.generation import generate_for_demi_journee

router = APIRouter(
    prefix="/admin/demi-journees",
    tags=["demi-journees"],
    dependencies=[Depends(require_admin)],
)


@router.post("/", response_model=DemiJourneeOut, status_code=201)
def create_demi_journee(body: DemiJourneeCreate, db: Session = Depends(get_db)):
    dj = DemiJournee(**body.model_dump())
    db.add(dj)
    db.commit()
    db.refresh(dj)
    return dj


@router.get("/{dj_id}", response_model=DemiJourneeOut)
def get_demi_journee(dj_id: int, db: Session = Depends(get_db)):
    dj = db.get(DemiJournee, dj_id)
    if not dj:
        raise HTTPException(status_code=404, detail="DemiJournee not found")
    return dj


@router.put("/{dj_id}", response_model=DemiJourneeOut)
def update_demi_journee(dj_id: int, body: DemiJourneeUpdate, db: Session = Depends(get_db)):
    dj = db.get(DemiJournee, dj_id)
    if not dj:
        raise HTTPException(status_code=404, detail="DemiJournee not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(dj, field, value)
    db.commit()
    db.refresh(dj)
    return dj


@router.delete("/{dj_id}", status_code=204)
def delete_demi_journee(dj_id: int, db: Session = Depends(get_db)):
    dj = db.get(DemiJournee, dj_id)
    if not dj:
        raise HTTPException(status_code=404, detail="DemiJournee not found")
    db.delete(dj)
    db.commit()


@router.post("/{dj_id}/generate")
def generate_epreuves(
    dj_id: int,
    body: GenerateEpreuvesIn,
    db: Session = Depends(get_db),
):
    """
    (Re-)génère les épreuves pour une demi-journée selon les paramètres fournis.
    Supprime les épreuves existantes avant de générer.
    """
    dj = db.get(DemiJournee, dj_id)
    if not dj:
        raise HTTPException(status_code=404, detail="DemiJournee not found")

    count = generate_for_demi_journee(db, dj, body)
    return {"demi_journee_id": dj_id, "epreuves_created": count}
