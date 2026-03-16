import secrets
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


def _gen_code() -> str:
    return secrets.token_hex(4).upper()  # ex: "A3F7B2C9"


class Candidat(Base):
    __tablename__ = "candidat"

    id: Mapped[int] = mapped_column(primary_key=True)
    planning_id: Mapped[int] = mapped_column(
        ForeignKey("planning.id", ondelete="CASCADE"), nullable=False
    )

    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Identifiants de connexion (login/mot de passe)
    login: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Profil concours (HGG = Histoire-Géographie-Géopolitique, ESH = Économie)
    profil: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Code UAI de l'établissement (détection conflit examinateur même lycée)
    code_uai: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Réinitialisation de mot de passe
    reset_token: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    reset_token_expires_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Code d'accès legacy (portail simple par code)
    code_acces: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, default=_gen_code
    )

    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="INSCRIT")

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    inscriptions = relationship("Inscription", back_populates="candidat")
    liste_attente = relationship("ListeAttente", back_populates="candidat")
    notes = relationship("Note", back_populates="candidat")
