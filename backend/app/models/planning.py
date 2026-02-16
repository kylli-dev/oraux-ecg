from sqlalchemy import Date, DateTime, String, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Planning(Base):
    __tablename__ = "planning"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)

    date_debut: Mapped[Date] = mapped_column(Date, nullable=False)
    date_fin: Mapped[Date] = mapped_column(Date, nullable=False)

    date_ouverture_inscriptions: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    date_fermeture_inscriptions: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)

    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="BROUILLON")

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("date_debut < date_fin", name="chk_planning_dates"),
        CheckConstraint("date_ouverture_inscriptions < date_fermeture_inscriptions", name="chk_planning_inscriptions"),
    )
