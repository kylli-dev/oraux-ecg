from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.candidat import Candidat
from app.models.epreuve import Epreuve
from app.models.inscription import Inscription, InscriptionEpreuve
from app.models.liste_attente import ListeAttente
from app.models.note import Note
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


@router.delete("/planning/{planning_id}/all", status_code=200)
def delete_all_candidats(planning_id: int, db: Session = Depends(get_db)):
    """Supprime tous les candidats d'un planning (désassigne les épreuves d'abord)."""
    candidats = db.query(Candidat).filter_by(planning_id=planning_id).all()
    count = len(candidats)
    candidat_ids = [c.id for c in candidats]
    if candidat_ids:
        db.query(Epreuve).filter(Epreuve.candidat_id.in_(candidat_ids)).update(
            {"candidat_id": None, "statut": "LIBRE"}, synchronize_session="fetch"
        )
        insc_ids = [i.id for i in db.query(Inscription.id).filter(Inscription.candidat_id.in_(candidat_ids)).all()]
        if insc_ids:
            db.query(InscriptionEpreuve).filter(InscriptionEpreuve.inscription_id.in_(insc_ids)).delete(synchronize_session="fetch")
        db.query(Inscription).filter(Inscription.candidat_id.in_(candidat_ids)).delete(synchronize_session="fetch")
        db.query(ListeAttente).filter(ListeAttente.candidat_id.in_(candidat_ids)).delete(synchronize_session="fetch")
        db.query(Note).filter(Note.candidat_id.in_(candidat_ids)).delete(synchronize_session="fetch")
        db.query(Candidat).filter_by(planning_id=planning_id).delete(synchronize_session="fetch")
    db.commit()
    return {"deleted": count}


@router.delete("/{candidat_id}", status_code=204)
def delete_candidat(candidat_id: int, db: Session = Depends(get_db)):
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")
    # Désassigner les épreuves liées
    db.query(Epreuve).filter_by(candidat_id=candidat_id).update(
        {"candidat_id": None, "statut": "LIBRE"}
    )
    # Supprimer les enregistrements liés (cascade ORM manuelle)
    insc_ids = [i.id for i in db.query(Inscription).filter_by(candidat_id=candidat_id).all()]
    if insc_ids:
        db.query(InscriptionEpreuve).filter(InscriptionEpreuve.inscription_id.in_(insc_ids)).delete(synchronize_session="fetch")
    db.query(Inscription).filter_by(candidat_id=candidat_id).delete()
    db.query(ListeAttente).filter_by(candidat_id=candidat_id).delete()
    db.query(Note).filter_by(candidat_id=candidat_id).delete()
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
