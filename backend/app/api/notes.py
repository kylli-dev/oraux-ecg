"""
Gestion admin des notes : consultation, publication individuelle ou en masse.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.note import Note
from app.models.candidat import Candidat

router = APIRouter(
    prefix="/admin/notes",
    tags=["notes"],
    dependencies=[Depends(require_admin)],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class NoteOut(BaseModel):
    id: int
    candidat_id: int
    candidat_nom: str
    candidat_prenom: str
    matiere: str
    valeur: Optional[float]
    statut: str

    class Config:
        from_attributes = True


class PublierBulkIn(BaseModel):
    note_ids: List[int]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[NoteOut])
def list_notes(
    statut: Optional[str] = None,
    candidat_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Note, Candidat).join(Candidat, Note.candidat_id == Candidat.id)
    if statut:
        q = q.filter(Note.statut == statut.upper())
    if candidat_id:
        q = q.filter(Note.candidat_id == candidat_id)
    q = q.order_by(Candidat.nom, Candidat.prenom, Note.matiere)

    return [
        NoteOut(
            id=note.id,
            candidat_id=note.candidat_id,
            candidat_nom=candidat.nom,
            candidat_prenom=candidat.prenom,
            matiere=note.matiere,
            valeur=note.valeur,
            statut=note.statut,
        )
        for note, candidat in q.all()
    ]


@router.post("/{note_id}/publier", response_model=NoteOut)
def publier_note(note_id: int, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    note.statut = "PUBLIE"
    note.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)
    candidat = db.get(Candidat, note.candidat_id)
    return NoteOut(
        id=note.id,
        candidat_id=note.candidat_id,
        candidat_nom=candidat.nom,
        candidat_prenom=candidat.prenom,
        matiere=note.matiere,
        valeur=note.valeur,
        statut=note.statut,
    )


@router.post("/publier-bulk")
def publier_bulk(body: PublierBulkIn, db: Session = Depends(get_db)):
    """Publie plusieurs notes d'un coup."""
    count = 0
    now = datetime.now(timezone.utc)
    for note_id in body.note_ids:
        note = db.get(Note, note_id)
        if note and note.statut == "BROUILLON":
            note.statut = "PUBLIE"
            note.published_at = now
            count += 1
    db.commit()
    return {"publiees": count}


@router.post("/publier-tout")
def publier_tout(db: Session = Depends(get_db)):
    """Publie toutes les notes en statut BROUILLON."""
    notes = db.query(Note).filter_by(statut="BROUILLON").all()
    now = datetime.now(timezone.utc)
    for note in notes:
        note.statut = "PUBLIE"
        note.published_at = now
    db.commit()
    return {"publiees": len(notes)}
