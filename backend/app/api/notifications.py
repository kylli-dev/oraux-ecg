"""Notifications de l'espace admin (cloche) — écrites par services/notifications.py."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Query as RequeteSQL, Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.notification_admin import NotificationAdmin

router = APIRouter(
    prefix="/admin/notifications",
    tags=["notifications"],
    dependencies=[Depends(require_admin)],
)


class NotificationOut(BaseModel):
    id: int
    date: str  # ISO UTC
    type: str
    titre: str
    message: str
    planning_id: Optional[int] = None
    candidat_id: Optional[int] = None
    lue: bool
    nombre: int = 1


class NotificationsOut(BaseModel):
    non_lues: int
    notifications: List[NotificationOut]


def _maintenant() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _visibles(db: Session, role: Optional[str], admin_id: Optional[str]) -> RequeteSQL:
    """Notifications que voit l'admin connecté (rôle et id transmis par le proxy Next.js) :
    les alertes d'activité seulement pour les super-admins, et jamais sur leurs propres actions."""
    q = db.query(NotificationAdmin)
    if role != "super_admin":
        return q.filter(NotificationAdmin.reservee_super_admin.is_(False))
    if admin_id and admin_id.isdigit():
        q = q.filter(or_(NotificationAdmin.acteur_admin_id.is_(None), NotificationAdmin.acteur_admin_id != int(admin_id)))
    return q


@router.get("/", response_model=NotificationsOut)
def lister(
    limite: int = Query(30, ge=1, le=200),
    x_admin_role: Optional[str] = Header(default=None),
    x_admin_id: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """Les plus récentes d'abord, et le nombre de non lues."""
    lignes = _visibles(db, x_admin_role, x_admin_id).order_by(NotificationAdmin.created_at.desc(), NotificationAdmin.id.desc()).limit(limite).all()
    non_lues = _visibles(db, x_admin_role, x_admin_id).filter(NotificationAdmin.lue_le.is_(None)).count()
    return NotificationsOut(
        non_lues=non_lues,
        notifications=[
            NotificationOut(
                id=n.id, date=n.created_at.replace(tzinfo=timezone.utc).isoformat(), type=n.type,
                titre=n.titre, message=n.message, planning_id=n.planning_id,
                candidat_id=n.candidat_id, lue=n.lue_le is not None, nombre=n.nombre or 1,
            )
            for n in lignes
        ],
    )


@router.post("/{notification_id}/lue", status_code=204)
def marquer_lue(notification_id: int, db: Session = Depends(get_db)):
    n = db.get(NotificationAdmin, notification_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    if n.lue_le is None:
        n.lue_le = _maintenant()
        db.commit()


@router.post("/tout-lu", status_code=204)
def tout_marquer_lu(
    x_admin_role: Optional[str] = Header(default=None),
    x_admin_id: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    _visibles(db, x_admin_role, x_admin_id).filter(NotificationAdmin.lue_le.is_(None)).update(
        {NotificationAdmin.lue_le: _maintenant()}, synchronize_session=False
    )
    db.commit()
