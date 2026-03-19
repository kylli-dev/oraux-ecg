from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ExaminateurIndisponibilite(Base):
    __tablename__ = "examinateur_indisponibilite"

    id: Mapped[int] = mapped_column(primary_key=True)
    examinateur_id: Mapped[int] = mapped_column(
        ForeignKey("examinateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    debut: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fin: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    commentaire: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
