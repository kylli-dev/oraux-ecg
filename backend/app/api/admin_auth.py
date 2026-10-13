from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.core.auth import (
    generate_reset_token,
    hash_password,
    reset_token_expiry,
    verify_password,
    RESET_TOKEN_EXPIRE_MINUTES,
)
from app.db.deps import get_db
from app.models.admin import Admin
from app.schemas.admin import (
    AdminChangePasswordIn,
    AdminLoginIn,
    AdminMotDePasseOublieIn,
    AdminOut,
    AdminReinitialiserIn,
)

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"], dependencies=[Depends(require_admin)])


@router.post("/login", response_model=AdminOut)
def login(body: AdminLoginIn, db: Session = Depends(get_db)):
    """Vérifie les identifiants d'un compte admin (username + mot de passe)."""
    a = db.query(Admin).filter_by(username=body.username.strip()).first()
    if not a or not a.actif or not verify_password(body.password, a.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    return a


@router.post("/change-password", response_model=AdminOut)
def change_password(body: AdminChangePasswordIn, db: Session = Depends(get_db)):
    """Le titulaire d'un compte admin change lui-même son mot de passe (mot de passe actuel requis)."""
    a = db.query(Admin).filter_by(username=body.username.strip()).first()
    if not a or not a.actif or not verify_password(body.current_password, a.password_hash):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    a.password_hash = hash_password(body.new_password)
    a.must_change_password = False
    db.commit()
    db.refresh(a)
    return a


@router.post("/forgot-password", status_code=204)
def admin_mot_de_passe_oublie(
    body: AdminMotDePasseOublieIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db),
):
    """
    Envoie un lien de réinitialisation à l'adresse email du compte admin (identifié par son
    nom d'utilisateur ou son email). Sans adresse email enregistrée, rien n'est envoyé :
    c'est alors au super-administrateur de réinitialiser le mot de passe. Réponse toujours
    204 (pas d'énumération des comptes), envoi en tâche de fond.
    """
    from sqlalchemy import func as _func, or_
    from app.services.email import build_reset_password_candidat, send_reset_password_candidat
    saisie = body.identifiant.strip().lower()
    a = (
        db.query(Admin)
        .filter(or_(_func.lower(Admin.username) == saisie, _func.lower(Admin.email) == saisie))
        .first()
    )
    if a and a.actif and a.email:
        a.reset_token = generate_reset_token()
        a.reset_token_expires_at = reset_token_expiry()
        sujet, corps, url = build_reset_password_candidat(
            a.username, "", a.username, a.reset_token, RESET_TOKEN_EXPIRE_MINUTES, db=db, espace="admin",
        )
        background_tasks.add_task(send_reset_password_candidat, a.email, a.username, sujet, corps, url)
        db.commit()


@router.post("/reset-password", response_model=AdminOut)
def admin_reinitialiser(body: AdminReinitialiserIn, db: Session = Depends(get_db)):
    """Définit le mot de passe avec le lien reçu par email (30 min, usage unique)."""
    from datetime import datetime, timezone
    a = db.query(Admin).filter_by(reset_token=body.token).first()
    if not a or not a.actif or not a.reset_token_expires_at:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    if a.reset_token_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    a.password_hash = hash_password(body.new_password)
    a.must_change_password = False
    a.reset_token = None
    a.reset_token_expires_at = None
    db.commit()
    db.refresh(a)
    return a
