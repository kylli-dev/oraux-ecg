from typing import Optional
from sqlalchemy import Time, String, Integer, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Epreuve(Base):
    __tablename__ = "epreuve"

    id: Mapped[int] = mapped_column(primary_key=True)

    demi_journee_id: Mapped[int] = mapped_column(
        ForeignKey("demi_journee.id", ondelete="CASCADE"),
        nullable=False,
    )

    matiere: Mapped[str] = mapped_column(String(100), nullable=False)

    heure_debut: Mapped[Time] = mapped_column(Time, nullable=False)
    heure_fin: Mapped[Time] = mapped_column(Time, nullable=False)

    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="CREE")

    # Candidat assigné (nullable)
    candidat_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("candidat.id", ondelete="SET NULL"),
        nullable=True,
    )

    candidat = relationship("Candidat", foreign_keys=[candidat_id])

    examinateur_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("examinateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    examinateur = relationship("Examinateur", foreign_keys=[examinateur_id])

    __table_args__ = (
        CheckConstraint("heure_debut < heure_fin", name="chk_epreuve_hours"),
    )
