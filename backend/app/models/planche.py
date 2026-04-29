from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Planche(Base):
    __tablename__ = "planche"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    fichier_path: Mapped[str] = mapped_column(String(500), nullable=False)
    fichier_data: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    matiere_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("matiere.id", ondelete="SET NULL"), nullable=True
    )
    examinateur_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("examinateur.id", ondelete="SET NULL"), nullable=True
    )
    statut: Mapped[str] = mapped_column(String(20), default="ACTIF", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    matiere = relationship("Matiere", foreign_keys=[matiere_id])
    examinateur = relationship("Examinateur", foreign_keys=[examinateur_id])
