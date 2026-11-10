from datetime import datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Time, String, ForeignKey, UniqueConstraint, CheckConstraint
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

    # Gabarit (journée type) qui a produit la demi-journée ; NULL = création ou génération manuelle.
    # Le nom est figé à l'application : il reste lisible si le gabarit est renommé ou supprimé.
    journee_type_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journee_type.id", ondelete="SET NULL"), nullable=True)
    journee_type_nom: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gabarit_applique_le: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # UTC sans fuseau

    __table_args__ = (
        UniqueConstraint("planning_id", "date", "type", name="uq_demi_journee_planning_date_type"),
        CheckConstraint("heure_debut < heure_fin", name="chk_demi_journee_hours"),
    )
