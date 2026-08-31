from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.core.auth import hash_password
from app.db.deps import get_db
from app.models.admin import Admin
from app.schemas.admin import AdminCreate, AdminOut, AdminUpdate

router = APIRouter(prefix="/admin/comptes", tags=["admins"], dependencies=[Depends(require_admin)])


@router.get("/", response_model=List[AdminOut])
def list_admins(db: Session = Depends(get_db)):
    return db.query(Admin).order_by(Admin.username).all()


@router.post("/", response_model=AdminOut, status_code=201)
def create_admin(body: AdminCreate, db: Session = Depends(get_db)):
    if db.query(Admin).filter_by(username=body.username.strip()).first():
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur existe déjà")
    a = Admin(username=body.username.strip(), password_hash=hash_password(body.password))
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.patch("/{admin_id}", response_model=AdminOut)
def update_admin(admin_id: int, body: AdminUpdate, db: Session = Depends(get_db)):
    a = db.get(Admin, admin_id)
    if not a:
        raise HTTPException(status_code=404, detail="Compte introuvable")

    if body.actif is not None:
        if body.actif is False and a.actif:
            nb_actifs = db.query(Admin).filter_by(actif=True).count()
            if nb_actifs <= 1:
                raise HTTPException(status_code=409, detail="Impossible de désactiver le dernier compte admin actif")
        a.actif = body.actif

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
    db.delete(a)
    db.commit()
