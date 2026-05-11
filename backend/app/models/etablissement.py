from typing import Optional
from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class Etablissement(Base):
    __tablename__ = "etablissement"

    id: Mapped[int] = mapped_column(primary_key=True)
    code_uai: Mapped[str] = mapped_column(String(20), nullable=False)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    ville: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    departement: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    academie: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    __table_args__ = (
        UniqueConstraint("code_uai", name="uq_etablissement_code_uai"),
    )
