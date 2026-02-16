from sqlalchemy import Date, Time, String, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DemiJournee(Base):
    __tablename__ = "demi_journee"

    id: Mapped[int] = mapped_column(primary_key=True)

    planning_id: Mapped[int] = mapped_column(ForeignKey("planning.id", ondelete="CASCADE"), nullable=False)

    date: Mapped[Date] = mapped_column(Date, nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # MATIN / APRES_MIDI

    heure_debut: Mapped[Time] = mapped_column(Time, nullable=False)
    heure_fin: Mapped[Time] = mapped_column(Time, nullable=False)

    __table_args__ = (
        UniqueConstraint("planning_id", "date", "type", name="uq_demi_journee_planning_date_type"),
        CheckConstraint("heure_debut < heure_fin", name="chk_demi_journee_hours"),
    )
