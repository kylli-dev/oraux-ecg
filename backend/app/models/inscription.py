from typing import Optional
from sqlalchemy import ForeignKey, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Inscription(Base):
    """Inscription d'un candidat à un triplet de 3 créneaux d'oral."""

    __tablename__ = "inscription"

    id: Mapped[int] = mapped_column(primary_key=True)

    candidat_id: Mapped[int] = mapped_column(
        ForeignKey("candidat.id", ondelete="CASCADE"), nullable=False
    )

    # ACTIVE = inscription en cours ; ANNULEE = annulée par le candidat
    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    cancelled_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    candidat = relationship("Candidat", back_populates="inscriptions")
    epreuves = relationship("InscriptionEpreuve", back_populates="inscription", cascade="all, delete-orphan")


class InscriptionEpreuve(Base):
    """Association entre une inscription et une épreuve (3 épreuves par inscription)."""

    __tablename__ = "inscription_epreuve"

    id: Mapped[int] = mapped_column(primary_key=True)

    inscription_id: Mapped[int] = mapped_column(
        ForeignKey("inscription.id", ondelete="CASCADE"), nullable=False
    )
    epreuve_id: Mapped[int] = mapped_column(
        ForeignKey("epreuve.id", ondelete="CASCADE"), nullable=False
    )

    inscription = relationship("Inscription", back_populates="epreuves")
    epreuve = relationship("Epreuve")

    __table_args__ = (
        UniqueConstraint("inscription_id", "epreuve_id", name="uq_inscription_epreuve"),
    )
