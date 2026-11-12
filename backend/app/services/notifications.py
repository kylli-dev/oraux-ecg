"""
Notifications aux administrateurs : une ligne dans notification_admin (cloche de l'espace
admin) et un email à chaque admin actif qui a renseigné son adresse.
"""
from __future__ import annotations

from datetime import datetime, timezone
from html import escape
from typing import Optional

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.models.admin import Admin
from app.models.notification_admin import NotificationAdmin
from app.services.email import send_email


def notifier_admins(
    db: Session,
    background_tasks: BackgroundTasks,
    type_: str,
    titre: str,
    message: str,
    planning_id: Optional[int] = None,
    candidat_id: Optional[int] = None,
) -> NotificationAdmin:
    """Ajoute la notification (l'appelant fait le commit) et programme les emails."""
    notif = NotificationAdmin(
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        type=type_,
        planning_id=planning_id,
        candidat_id=candidat_id,
        titre=titre[:200],
        message=message[:1000],
    )
    db.add(notif)

    corps = (
        f"<p>{escape(message)}</p>"
        "<p>Retrouvez les notifications dans l'espace admin (cloche en bas du menu).</p>"
    )
    adresses = {
        a.email.strip()
        for a in db.query(Admin).filter(Admin.actif.is_(True), Admin.email.isnot(None)).all()
        if a.email and a.email.strip()
    }
    for adresse in sorted(adresses):
        background_tasks.add_task(send_email, adresse, f"[Oraux ECG] {titre}", corps)
    return notif
