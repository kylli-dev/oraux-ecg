import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.core.auth import hash_password
from app.db.deps import get_db
from app.models.surveillant import Surveillant
from app.schemas.surveillant import (
    SurveillantCreate,
    SurveillantCreatedOut,
    SurveillantOut,
    SurveillantUpdate,
)
from app.services.email import send_credentials_surveillant

router = APIRouter(
    prefix="/admin/surveillants",
    tags=["surveillants"],
    dependencies=[Depends(require_admin)],
)


def _gen_password() -> str:
    return secrets.token_urlsafe(10)


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SurveillantOut])
def list_surveillants(planning_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Surveillant)
    if planning_id:
        q = q.filter_by(planning_id=planning_id)
    return q.order_by(Surveillant.nom, Surveillant.prenom).all()


@router.post("/", response_model=SurveillantCreatedOut, status_code=201)
def create_surveillant(body: SurveillantCreate, db: Session = Depends(get_db)):
    """
    Crée un surveillant, génère ses identifiants (login = email, mdp aléatoire)
    et envoie la notification par email si le SMTP est configuré.
    Retourne le mot de passe en clair pour affichage admin.
    """
    plain_pwd = _gen_password()
    s = Surveillant(
        planning_id=body.planning_id,
        nom=body.nom.strip().upper(),
        prenom=body.prenom.strip(),
        email=body.email.strip(),
        actif=body.actif,
        password_hash=hash_password(plain_pwd, rounds=4),
    )
    db.add(s)
    db.commit()
    db.refresh(s)

    email_sent = send_credentials_surveillant(
        to_email=s.email,
        prenom=s.prenom,
        nom=s.nom,
        login=s.email,
        plain_password=plain_pwd,
        db=db,
    )

    return SurveillantCreatedOut(
        id=s.id,
        planning_id=s.planning_id,
        nom=s.nom,
        prenom=s.prenom,
        email=s.email,
        actif=s.actif,
        code_acces=s.code_acces,
        plain_password=plain_pwd,
        email_sent=email_sent,
    )


@router.get("/{surveillant_id}", response_model=SurveillantOut)
def get_surveillant(surveillant_id: int, db: Session = Depends(get_db)):
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    return s


@router.put("/{surveillant_id}", response_model=SurveillantOut)
def update_surveillant(surveillant_id: int, body: SurveillantUpdate, db: Session = Depends(get_db)):
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    data = body.model_dump(exclude_none=True)
    if "nom" in data:
        data["nom"] = data["nom"].strip().upper()
    if "prenom" in data:
        data["prenom"] = data["prenom"].strip()
    if "email" in data:
        data["email"] = data["email"].strip()
    for field, value in data.items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.patch("/{surveillant_id}/actif", response_model=SurveillantOut)
def toggle_actif(surveillant_id: int, body: dict, db: Session = Depends(get_db)):
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    s.actif = bool(body.get("actif", True))
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{surveillant_id}", status_code=204)
def delete_surveillant(surveillant_id: int, db: Session = Depends(get_db)):
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    db.delete(s)
    db.commit()


# ── Renvoi des identifiants ────────────────────────────────────────────────────

@router.post("/{surveillant_id}/envoyer-identifiants", response_model=SurveillantCreatedOut)
def envoyer_identifiants(surveillant_id: int, db: Session = Depends(get_db)):
    """
    Génère un nouveau mot de passe pour le surveillant et envoie la notification.
    Retourne le mot de passe en clair pour affichage admin.
    """
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")

    plain_pwd = _gen_password()
    s.password_hash = hash_password(plain_pwd, rounds=4)
    db.commit()
    db.refresh(s)

    email_sent = send_credentials_surveillant(
        to_email=s.email,
        prenom=s.prenom,
        nom=s.nom,
        login=s.email,
        plain_password=plain_pwd,
        db=db,
    )

    return SurveillantCreatedOut(
        id=s.id,
        planning_id=s.planning_id,
        nom=s.nom,
        prenom=s.prenom,
        email=s.email,
        actif=s.actif,
        code_acces=s.code_acces,
        plain_password=plain_pwd,
        email_sent=email_sent,
    )
