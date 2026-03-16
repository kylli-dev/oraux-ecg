from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.candidat import Candidat
from app.models.epreuve import Epreuve
from app.schemas.candidat import (
    CandidatCreate,
    CandidatOut,
    CandidatUpdate,
    AssignerCandidatIn,
)

router = APIRouter(
    prefix="/admin/candidats",
    tags=["candidats"],
    dependencies=[Depends(require_admin)],
)


# ── CRUD candidats ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[CandidatOut])
def list_candidats(planning_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Candidat)
    if planning_id:
        q = q.filter_by(planning_id=planning_id)
    return q.order_by(Candidat.nom, Candidat.prenom).all()


@router.post("/", response_model=CandidatOut, status_code=201)
def create_candidat(body: CandidatCreate, db: Session = Depends(get_db)):
    c = Candidat(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{candidat_id}", response_model=CandidatOut)
def get_candidat(candidat_id: int, db: Session = Depends(get_db)):
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")
    return c


@router.put("/{candidat_id}", response_model=CandidatOut)
def update_candidat(candidat_id: int, body: CandidatUpdate, db: Session = Depends(get_db)):
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{candidat_id}", status_code=204)
def delete_candidat(candidat_id: int, db: Session = Depends(get_db)):
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")
    # Désassigner les épreuves liées
    db.query(Epreuve).filter_by(candidat_id=candidat_id).update(
        {"candidat_id": None, "statut": "LIBRE"}
    )
    db.delete(c)
    db.commit()


# ── Assignation épreuve ────────────────────────────────────────────────────────

@router.post("/epreuves/{epreuve_id}/assigner")
def assigner_candidat(
    epreuve_id: int,
    body: AssignerCandidatIn,
    db: Session = Depends(get_db),
):
    """Assigne ou désassigne un candidat à une épreuve."""
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")

    if body.candidat_id is None:
        # Désassigner
        e.candidat_id = None
        e.statut = "LIBRE"
    else:
        c = db.get(Candidat, body.candidat_id)
        if not c:
            raise HTTPException(status_code=404, detail="Candidat not found")
        e.candidat_id = body.candidat_id
        e.statut = "ATTRIBUEE"

    db.commit()
    return {"epreuve_id": epreuve_id, "candidat_id": e.candidat_id, "statut": e.statut}
