"""Notifications de l'espace admin (cloche) — écrites par services/notifications.py."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

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


class NotificationsOut(BaseModel):
    non_lues: int
    notifications: List[NotificationOut]


def _maintenant() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/", response_model=NotificationsOut)
def lister(limite: int = Query(30, ge=1, le=200), db: Session = Depends(get_db)):
    """Les plus récentes d'abord, et le nombre de non lues."""
    lignes = db.query(NotificationAdmin).order_by(NotificationAdmin.id.desc()).limit(limite).all()
    non_lues = db.query(NotificationAdmin).filter(NotificationAdmin.lue_le.is_(None)).count()
    return NotificationsOut(
        non_lues=non_lues,
        notifications=[
            NotificationOut(
                id=n.id, date=n.created_at.replace(tzinfo=timezone.utc).isoformat(), type=n.type,
                titre=n.titre, message=n.message, planning_id=n.planning_id,
                candidat_id=n.candidat_id, lue=n.lue_le is not None,
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
def tout_marquer_lu(db: Session = Depends(get_db)):
    db.query(NotificationAdmin).filter(NotificationAdmin.lue_le.is_(None)).update(
        {NotificationAdmin.lue_le: _maintenant()}, synchronize_session=False
    )
    db.commit()
