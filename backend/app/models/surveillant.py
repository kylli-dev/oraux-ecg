import secrets
from typing import Optional
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _gen_code() -> str:
    return secrets.token_hex(4).upper()


class Surveillant(Base):
    __tablename__ = "surveillant"

    id: Mapped[int] = mapped_column(primary_key=True)

    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Identifiants portail
    code_acces: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, default=_gen_code
    )
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
