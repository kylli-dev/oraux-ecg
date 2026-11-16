from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Annulation(Base):
    """
    État d'avant une grosse action de l'admin (application d'un gabarit, suppression d'une
    journée, affectation groupée, salles par défaut, numérotation des triplets), pour pouvoir
    l'annuler pendant 24 h — voir services/annulations.py.
    """
    __tablename__ = "annulation"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)  # UTC sans fuseau
    # DATE : instantané d'une date entière ; CHAMPS : valeurs avant/après de champs d'épreuves
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    planning_id: Mapped[int] = mapped_column(Integer, nullable=False)
    libelle: Mapped[str] = mapped_column(String(300), nullable=False)
    admin_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    admin_nom: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    donnees: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    annulee_le: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
