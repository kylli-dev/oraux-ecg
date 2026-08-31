from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.core.auth import verify_password
from app.db.deps import get_db
from app.models.admin import Admin
from app.schemas.admin import AdminLoginIn, AdminOut

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"], dependencies=[Depends(require_admin)])


@router.post("/login", response_model=AdminOut)
def login(body: AdminLoginIn, db: Session = Depends(get_db)):
    """Vérifie les identifiants d'un compte admin (username + mot de passe)."""
    a = db.query(Admin).filter_by(username=body.username.strip()).first()
    if not a or not a.actif or not verify_password(body.password, a.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    return a
