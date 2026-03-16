from sqlalchemy import Date, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ListeAttente(Base):
    """Enregistrement d'un candidat sur liste d'attente pour une journée donnée."""

    __tablename__ = "liste_attente"

    id: Mapped[int] = mapped_column(primary_key=True)

    candidat_id: Mapped[int] = mapped_column(
        ForeignKey("candidat.id", ondelete="CASCADE"), nullable=False
    )

    # Journée pour laquelle le candidat se déclare disponible
    date: Mapped[Date] = mapped_column(Date, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    candidat = relationship("Candidat", back_populates="liste_attente")

    __table_args__ = (
        UniqueConstraint("candidat_id", "date", name="uq_liste_attente_candidat_date"),
    )
