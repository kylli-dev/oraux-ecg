from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin, require_super_admin
from app.core.auth import hash_password
from app.db.deps import get_db
from app.models.admin import Admin
from app.schemas.admin import AdminCreate, AdminOut, AdminUpdate

router = APIRouter(
    prefix="/admin/comptes",
    tags=["admins"],
    dependencies=[Depends(require_admin), Depends(require_super_admin)],
)


def _nb_super_admins_actifs(db: Session, exclude_id: int | None = None) -> int:
    q = db.query(Admin).filter_by(role="super_admin", actif=True)
    if exclude_id is not None:
        q = q.filter(Admin.id != exclude_id)
    return q.count()


@router.get("/", response_model=List[AdminOut])
def list_admins(db: Session = Depends(get_db)):
    return db.query(Admin).order_by(Admin.username).all()


@router.post("/", response_model=AdminOut, status_code=201)
def create_admin(body: AdminCreate, db: Session = Depends(get_db)):
    if db.query(Admin).filter_by(username=body.username.strip()).first():
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur existe déjà")
    a = Admin(username=body.username.strip(), password_hash=hash_password(body.password), role=body.role)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.patch("/{admin_id}", response_model=AdminOut)
def update_admin(admin_id: int, body: AdminUpdate, db: Session = Depends(get_db)):
    a = db.get(Admin, admin_id)
    if not a:
        raise HTTPException(status_code=404, detail="Compte introuvable")

    devient_inactif = body.actif is False and a.actif
    devient_admin_simple = body.role == "admin" and a.role == "super_admin"

    if (devient_inactif or devient_admin_simple) and a.role == "super_admin":
        if _nb_super_admins_actifs(db, exclude_id=a.id) < 1:
            raise HTTPException(status_code=409, detail="Impossible de retirer les droits du dernier super-admin actif")

    if body.actif is not None:
        if devient_inactif:
            nb_actifs = db.query(Admin).filter_by(actif=True).count()
            if nb_actifs <= 1:
                raise HTTPException(status_code=409, detail="Impossible de désactiver le dernier compte admin actif")
        a.actif = body.actif

    if body.role is not None:
        a.role = body.role

    if body.password:
        a.password_hash = hash_password(body.password)

    db.commit()
    db.refresh(a)
    return a


@router.delete("/{admin_id}", status_code=204)
def delete_admin(admin_id: int, db: Session = Depends(get_db)):
    a = db.get(Admin, admin_id)
    if not a:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    if a.actif:
        nb_actifs = db.query(Admin).filter_by(actif=True).count()
        if nb_actifs <= 1:
            raise HTTPException(status_code=409, detail="Impossible de supprimer le dernier compte admin actif")
        if a.role == "super_admin" and _nb_super_admins_actifs(db, exclude_id=a.id) < 1:
            raise HTTPException(status_code=409, detail="Impossible de supprimer le dernier super-admin actif")
    db.delete(a)
    db.commit()
