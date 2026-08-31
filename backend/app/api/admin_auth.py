from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.core.auth import hash_password, verify_password
from app.db.deps import get_db
from app.models.admin import Admin
from app.schemas.admin import AdminChangePasswordIn, AdminLoginIn, AdminOut

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
