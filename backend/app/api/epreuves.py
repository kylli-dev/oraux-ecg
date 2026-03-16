from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.epreuve import Epreuve
from app.schemas.epreuve import EpreuveCreate, EpreuveOut

router = APIRouter(
    prefix="/admin/epreuves",
    tags=["epreuves"],
    dependencies=[Depends(require_admin)],
)


@router.post("/", response_model=EpreuveOut, status_code=201)
def create_epreuve(body: EpreuveCreate, db: Session = Depends(get_db)):
    e = Epreuve(**body.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@router.get("/{epreuve_id}", response_model=EpreuveOut)
def get_epreuve(epreuve_id: int, db: Session = Depends(get_db)):
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")
    return e


@router.delete("/{epreuve_id}", status_code=204)
def delete_epreuve(epreuve_id: int, db: Session = Depends(get_db)):
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")
    db.delete(e)
    db.commit()
