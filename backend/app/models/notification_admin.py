from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationAdmin(Base):
    """
    Notification affichée dans l'espace admin (cloche) — ex. un candidat s'est mis en liste
    d'attente. Partagée entre tous les admins : « lue » dès qu'un admin l'a ouverte.
    """

    __tablename__ = "notification_admin"

    id: Mapped[int] = mapped_column(primary_key=True)
    # UTC, sans fuseau (comme audit_log)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    type: Mapped[str] = mapped_column(String(30), nullable=False)  # LISTE_ATTENTE | ACTIVITE
    planning_id: Mapped[Optional[int]] = mapped_column(ForeignKey("planning.id", ondelete="CASCADE"), nullable=True)
    candidat_id: Mapped[Optional[int]] = mapped_column(ForeignKey("candidat.id", ondelete="CASCADE"), nullable=True)

    titre: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(1000), nullable=False)

    lue_le: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Alerte d'activité (ACTIVITE) : visible des seuls super-admins, et pas de son auteur
    reservee_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    acteur_admin_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Actions identiques répétées en peu de temps regroupées en une seule ligne (× nombre)
    nombre: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (Index("ix_notification_admin_created_at", "created_at"),)
