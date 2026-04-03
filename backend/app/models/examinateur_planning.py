from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ExaminateurPlanning(Base):
    __tablename__ = "examinateur_planning"

    id: Mapped[int] = mapped_column(primary_key=True)
    examinateur_id: Mapped[int] = mapped_column(
        ForeignKey("examinateur.id", ondelete="CASCADE"), nullable=False
    )
    planning_id: Mapped[int] = mapped_column(
        ForeignKey("planning.id", ondelete="CASCADE"), nullable=False
    )
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("examinateur_id", "planning_id", name="uq_ex_planning"),
    )
