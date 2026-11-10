from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    """
    Journal d'activité (onglet Monitoring) : une ligne par action (requête d'écriture,
    connexion) et au plus une « consultation » toutes les quelques minutes par personne.
    Ni adresse IP ni contenu des requêtes. Purgé au-delà de JOURS_CONSERVATION (services/monitoring.py).
    """

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    # UTC, sans fuseau (comme cancelled_at des inscriptions)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # admin | candidat | examinateur | surveillant | anonyme
    acteur_type: Mapped[str] = mapped_column(String(20), nullable=False)
    acteur_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Nom figé au moment de l'action (identifiant admin) ; les autres sont résolus à la lecture
    acteur_nom: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    methode: Mapped[str] = mapped_column(String(10), nullable=False)
    # Gabarit de la route (« /admin/plannings/{planning_id} ») et chemin réel
    route: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    chemin: Mapped[str] = mapped_column(String(500), nullable=False)
    statut_http: Mapped[int] = mapped_column(Integer, nullable=False)
    duree_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_audit_log_created_at", "created_at"),
        Index("ix_audit_log_acteur", "acteur_type", "acteur_id"),
    )
