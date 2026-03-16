"""
Portail examinateur : accès via code_acces unique, saisie de notes.
"""
from typing import List, Optional
from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import create_examinateur_token, decode_examinateur_token
from app.db.deps import get_db
from app.models.examinateur import Examinateur
from app.models.epreuve import Epreuve
from app.models.demi_journee import DemiJournee
from app.models.candidat import Candidat
from app.models.note import Note

router = APIRouter(prefix="/examinateur", tags=["examinateur-portal"])

_bearer = HTTPBearer()


# ── Guard ─────────────────────────────────────────────────────────────────────

def get_current_examinateur(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
    db: Session = Depends(get_db),
) -> Examinateur:
    try:
        ex_id = decode_examinateur_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    ex = db.get(Examinateur, ex_id)
    if not ex:
        raise HTTPException(status_code=401, detail="Examinateur introuvable")
    return ex


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    code_acces: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ExaminateurMe(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    matieres: List[str]

    class Config:
        from_attributes = True


class EpreuveExaminateur(BaseModel):
    id: int
    date: Date
    matiere: str
    heure_debut: str
    heure_fin: str
    candidat_id: Optional[int]
    candidat_nom: Optional[str]
    candidat_prenom: Optional[str]
    note_valeur: Optional[float]
    note_statut: Optional[str]


class NoterIn(BaseModel):
    valeur: float


class NoterOut(BaseModel):
    note_id: int
    valeur: float
    statut: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    ex = db.query(Examinateur).filter_by(code_acces=body.code_acces.strip().upper()).first()
    if not ex:
        raise HTTPException(status_code=401, detail="Code d'accès invalide")
    token = create_examinateur_token(ex.id)
    return LoginOut(access_token=token)


@router.get("/me", response_model=ExaminateurMe)
def me(ex: Examinateur = Depends(get_current_examinateur)):
    return ExaminateurMe(
        id=ex.id,
        nom=ex.nom,
        prenom=ex.prenom,
        email=ex.email,
        matieres=ex.matieres,
    )


@router.get("/me/epreuves", response_model=List[EpreuveExaminateur])
def mes_epreuves(
    ex: Examinateur = Depends(get_current_examinateur),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Epreuve, DemiJournee)
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(Epreuve.examinateur_id == ex.id)
        .order_by(DemiJournee.date, Epreuve.heure_debut)
        .all()
    )

    result = []
    for epreuve, dj in rows:
        candidat = db.get(Candidat, epreuve.candidat_id) if epreuve.candidat_id else None
        note = None
        if candidat:
            note = (
                db.query(Note)
                .filter_by(candidat_id=candidat.id, matiere=epreuve.matiere)
                .first()
            )
        result.append(EpreuveExaminateur(
            id=epreuve.id,
            date=dj.date,
            matiere=epreuve.matiere,
            heure_debut=str(epreuve.heure_debut)[:5],
            heure_fin=str(epreuve.heure_fin)[:5],
            candidat_id=candidat.id if candidat else None,
            candidat_nom=candidat.nom if candidat else None,
            candidat_prenom=candidat.prenom if candidat else None,
            note_valeur=note.valeur if note else None,
            note_statut=note.statut if note else None,
        ))
    return result


@router.post("/me/epreuves/{epreuve_id}/noter", response_model=NoterOut)
def noter(
    epreuve_id: int,
    body: NoterIn,
    ex: Examinateur = Depends(get_current_examinateur),
    db: Session = Depends(get_db),
):
    epreuve = db.get(Epreuve, epreuve_id)
    if not epreuve or epreuve.examinateur_id != ex.id:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if not epreuve.candidat_id:
        raise HTTPException(status_code=400, detail="Aucun candidat assigné à cette épreuve")
    if not (0 <= body.valeur <= 20):
        raise HTTPException(status_code=422, detail="La note doit être entre 0 et 20")

    note = (
        db.query(Note)
        .filter_by(candidat_id=epreuve.candidat_id, matiere=epreuve.matiere)
        .first()
    )
    if note:
        note.valeur = body.valeur
    else:
        note = Note(
            candidat_id=epreuve.candidat_id,
            matiere=epreuve.matiere,
            valeur=body.valeur,
            statut="BROUILLON",
        )
        db.add(note)
    db.commit()
    db.refresh(note)
    return NoterOut(note_id=note.id, valeur=note.valeur, statut=note.statut)
