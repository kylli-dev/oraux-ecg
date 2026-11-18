import secrets
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Text, false
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
    # Mot de passe généré par l'admin (envoyé par email) : à changer dès la première connexion
    mot_de_passe_provisoire: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    # « Mot de passe oublié » : lien envoyé par email (valable 30 min, usage unique)
    reset_token: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reset_token_expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Ses créneaux tels qu'il les a vus la dernière fois (JSON) : sert au bandeau
    # « Votre planning a changé » quand un admin modifie une affectation après coup
    affectations_vues: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
