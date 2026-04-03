from sqlalchemy import Date, DateTime, Time, String, Boolean, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
import datetime

from app.db.base import Base


class Planning(Base):
    __tablename__ = "planning"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)

    date_debut: Mapped[Date] = mapped_column(Date, nullable=False)
    date_fin: Mapped[Date] = mapped_column(Date, nullable=False)

    date_ouverture_inscriptions: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    date_fermeture_inscriptions: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Heure limite d'inscription/désinscription pour le lendemain (défaut 16h00)
    heure_previs: Mapped[datetime.time] = mapped_column(
        Time, nullable=False, default=datetime.time(16, 0)
    )

    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="BROUILLON")

    # Paramètres comportementaux
    envoyer_convocations: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    interdire_modification_candidat: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    interdire_changement_creneau: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("date_debut < date_fin", name="chk_planning_dates"),
        CheckConstraint("date_ouverture_inscriptions < date_fermeture_inscriptions", name="chk_planning_inscriptions"),
    )
