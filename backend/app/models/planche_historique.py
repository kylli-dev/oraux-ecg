from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class PlancheHistorique(Base):
    """
    Journal des planches (sujets), en AJOUT SEUL : une ligne par événement (assignation,
    remplacement, retrait, suppression de la planche, impression du cartouche). Les lignes ne
    sont jamais modifiées ni supprimées, et chacune fige le contexte au moment de l'action
    (candidat, épreuve, examinateur, nom de la planche) — l'historique reste lisible même si
    l'épreuve, le candidat ou la planche sont ensuite modifiés ou supprimés.
    """

    __tablename__ = "planche_historique"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # ASSIGNEE | REMPLACEE | RETIREE | PLANCHE_SUPPRIMEE | IMPRIMEE | REPRISE (existant au démarrage)
    action: Mapped[str] = mapped_column(String(30), nullable=False)

    # Références (peuvent devenir nulles si l'objet est supprimé ensuite)
    epreuve_id: Mapped[Optional[int]] = mapped_column(ForeignKey("epreuve.id", ondelete="SET NULL"), nullable=True)
    planche_id: Mapped[Optional[int]] = mapped_column(ForeignKey("planche.id", ondelete="SET NULL"), nullable=True)
    planning_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Contexte figé au moment de l'action
    planche_nom: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    ancienne_planche_nom: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    matiere: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    date_epreuve: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    heure_debut: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    candidat_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    candidat_nom: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    examinateur_nom: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
