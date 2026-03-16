"""
Paramétrages admin : messages-type et réinitialisation des mots de passe.
"""
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.core.auth import hash_password
from app.db.deps import get_db
from app.models.candidat import Candidat
from app.models.examinateur import Examinateur
from app.models.message_type import MessageType

router = APIRouter(
    prefix="/admin/parametrages",
    tags=["parametrages"],
    dependencies=[Depends(require_admin)],
)

# ── Codes prédéfinis ────────────────────────────────────────────────────────────

MESSAGE_TYPE_DEFAULTS = {
    "ADMISSIBILITE": {
        "sujet": "Bienvenue sur la plateforme des oraux ECG — vos identifiants de connexion",
        "corps_html": (
            "<p>Bonjour {prenom} {nom},</p>"
            "<p>Félicitations, vous êtes admissible aux oraux ECG. "
            "Voici vos identifiants pour accéder à la plateforme :</p>"
            "<ul><li><strong>Login :</strong> {login}</li>"
            "<li><strong>Mot de passe provisoire :</strong> {password}</li></ul>"
            "<p>Rendez-vous sur <a href=\"{url}\">{url}</a></p>"
            "<p>Cordialement,<br>Le service des admissions</p>"
        ),
    },
    "CONVOCATION": {
        "sujet": "Confirmation de votre inscription aux oraux ECG",
        "corps_html": (
            "<p>Bonjour {prenom} {nom},</p>"
            "<p>Votre inscription aux oraux est confirmée pour le <strong>{date}</strong>.</p>"
            "<p>Vos créneaux :</p>{epreuves}"
            "<p>Cordialement,<br>Le service des admissions</p>"
        ),
    },
    "RAPPEL": {
        "sujet": "Rappel — vos oraux ECG ont lieu dans {jours} jour(s)",
        "corps_html": (
            "<p>Bonjour {prenom} {nom},</p>"
            "<p>Rappel : vos oraux ont lieu le <strong>{date}</strong>.</p>"
            "<p>Vos créneaux :</p>{epreuves}"
            "<p>Cordialement,<br>Le service des admissions</p>"
        ),
    },
    "DESINSCRIPTION": {
        "sujet": "Annulation de votre inscription aux oraux ECG",
        "corps_html": (
            "<p>Bonjour {prenom} {nom},</p>"
            "<p>Votre inscription aux oraux du <strong>{date}</strong> a bien été annulée.</p>"
            "<p>Vous pouvez vous réinscrire à tout moment sur la plateforme.</p>"
            "<p>Cordialement,<br>Le service des admissions</p>"
        ),
    },
    "LISTE_ATTENTE": {
        "sujet": "Enregistrement sur liste d'attente — oraux ECG",
        "corps_html": (
            "<p>Bonjour {prenom} {nom},</p>"
            "<p>Votre enregistrement sur liste d'attente a bien été pris en compte "
            "pour les journées suivantes :</p>{journees}"
            "<p>Vous serez contacté(e) si une place se libère.</p>"
            "<p>Cordialement,<br>Le service des admissions</p>"
        ),
    },
    "PUBLICATION_NOTES": {
        "sujet": "Vos notes d'oraux ECG sont disponibles",
        "corps_html": (
            "<p>Bonjour {prenom} {nom},</p>"
            "<p>Vos notes d'oraux sont maintenant disponibles sur la plateforme.</p>"
            "<p>Cordialement,<br>Le service des admissions</p>"
        ),
    },
}


def init_message_types(db: Session) -> None:
    """Crée les message-types manquants avec les valeurs par défaut."""
    for code, defaults in MESSAGE_TYPE_DEFAULTS.items():
        existing = db.query(MessageType).filter_by(code=code).first()
        if not existing:
            db.add(MessageType(code=code, **defaults))
    db.commit()


# ── Schemas ─────────────────────────────────────────────────────────────────────

class MessageTypeOut(BaseModel):
    code: str
    sujet: str
    corps_html: str

    class Config:
        from_attributes = True


class MessageTypeUpdate(BaseModel):
    sujet: str
    corps_html: str


class ResetPasswordOut(BaseModel):
    login: str
    new_password: str


# ── Routes message-types ────────────────────────────────────────────────────────

@router.get("/message-types/", response_model=List[MessageTypeOut])
def list_message_types(db: Session = Depends(get_db)):
    """Retourne tous les message-types, en les initialisant si besoin."""
    init_message_types(db)
    return db.query(MessageType).order_by(MessageType.code).all()


@router.get("/message-types/{code}", response_model=MessageTypeOut)
def get_message_type(code: str, db: Session = Depends(get_db)):
    mt = db.query(MessageType).filter_by(code=code.upper()).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Message-type introuvable")
    return mt


@router.put("/message-types/{code}", response_model=MessageTypeOut)
def update_message_type(
    code: str, body: MessageTypeUpdate, db: Session = Depends(get_db)
):
    mt = db.query(MessageType).filter_by(code=code.upper()).first()
    if not mt:
        raise HTTPException(status_code=404, detail="Message-type introuvable")
    mt.sujet = body.sujet
    mt.corps_html = body.corps_html
    db.commit()
    db.refresh(mt)
    return mt


# ── Réinitialisation mot de passe ───────────────────────────────────────────────

@router.post("/candidats/{candidat_id}/reset-password", response_model=ResetPasswordOut)
def reset_password_candidat(candidat_id: int, db: Session = Depends(get_db)):
    """
    Génère un nouveau mot de passe temporaire pour un candidat.
    En production : envoyer par email (Message-type ADMISSIBILITE).
    Retourne le mot de passe en clair pour affichage admin.
    """
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat introuvable")

    new_pwd = secrets.token_urlsafe(8)  # ex: "aB3xZ9qR"
    c.password_hash = hash_password(new_pwd)
    c.reset_token = None
    c.reset_token_expires_at = None
    db.commit()
    # TODO: envoyer Message-type ADMISSIBILITE avec le nouveau mot de passe

    return ResetPasswordOut(login=c.login or c.email, new_password=new_pwd)


@router.post("/examinateurs/{examinateur_id}/reset-password", response_model=ResetPasswordOut)
def reset_password_examinateur(examinateur_id: int, db: Session = Depends(get_db)):
    """Génère un nouveau mot de passe temporaire pour un examinateur."""
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur introuvable")

    new_pwd = secrets.token_urlsafe(8)
    # Examinateur n'a pas encore de password_hash — on le note pour future implémentation
    # ex.password_hash = hash_password(new_pwd)
    # db.commit()
    # TODO: envoyer email

    return ResetPasswordOut(login=ex.email, new_password=new_pwd)
