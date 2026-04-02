from typing import Optional
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class PlanningMatiereSalleDefaut(Base):
    """Salle par défaut pour une matière donnée dans un planning."""
    __tablename__ = "planning_matiere_salle_defaut"

    id: Mapped[int] = mapped_column(primary_key=True)
    planning_id: Mapped[int] = mapped_column(
        ForeignKey("planning.id", ondelete="CASCADE"), nullable=False
    )
    matiere: Mapped[str] = mapped_column(String(100), nullable=False)
    salle_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("salle.id", ondelete="SET NULL"), nullable=True
    )
    salle_preparation_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("salle.id", ondelete="SET NULL"), nullable=True
    )
    surveillant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("surveillant.id", ondelete="SET NULL"), nullable=True
    )

    salle = relationship("Salle", foreign_keys=[salle_id])
    salle_preparation = relationship("Salle", foreign_keys=[salle_preparation_id])
    surveillant = relationship("Surveillant", foreign_keys=[surveillant_id])

    __table_args__ = (
        UniqueConstraint("planning_id", "matiere", name="uq_planning_matiere_salle"),
    )
