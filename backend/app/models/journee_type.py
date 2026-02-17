from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class JourneeType(Base):
    __tablename__ = "journee_type"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)

    # valeurs par défaut (peuvent être surchargées par bloc)
    duree_defaut_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    pause_defaut_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    statut_initial: Mapped[str] = mapped_column(String(20), nullable=False, default="CREE")

    blocs = relationship("JourneeTypeBloc", back_populates="journee_type", cascade="all, delete-orphan")
