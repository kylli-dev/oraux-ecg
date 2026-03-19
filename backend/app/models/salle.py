from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Salle(Base):
    __tablename__ = "salle"

    id: Mapped[int] = mapped_column(primary_key=True)
    intitule: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
