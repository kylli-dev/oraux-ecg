from typing import Optional
from sqlalchemy import ForeignKey, DateTime, String, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Note(Base):
    """Note d'un candidat pour une matière d'oral."""

    __tablename__ = "note"

    id: Mapped[int] = mapped_column(primary_key=True)

    candidat_id: Mapped[int] = mapped_column(
        ForeignKey("candidat.id", ondelete="CASCADE"), nullable=False
    )

    matiere: Mapped[str] = mapped_column(String(100), nullable=False)

    valeur: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Note harmonisée saisie par le service des admissions
    note_harmonisee: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Commentaire de l'examinateur
    commentaire: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # BROUILLON = saisie en cours, non visible candidat ; PUBLIE = visible candidat
    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="BROUILLON")

    published_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    candidat = relationship("Candidat", back_populates="notes")
