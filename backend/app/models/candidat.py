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

    # Identifiant concours externe (CODE_CANDIDAT de l'établissement)
    code_candidat: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Numéro INE (identifiant national élève)
    numero_ine: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # État civil
    civilite: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    date_naissance: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    tel_portable: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Qualité / statut concours
    qualite: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    handicape: Mapped[Optional[bool]] = mapped_column(nullable=True)

    # Adresse
    cp: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    ville: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    libelle_pays: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Profil concours (HGG = Histoire-Géographie-Géopolitique, ESH = Économie)
    profil: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Établissement d'origine
    classe: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    code_uai: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # NUMERO_RNE
    etablissement: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    ville_etablissement: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    departement_etablissement: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Réinitialisation de mot de passe
    reset_token: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    reset_token_expires_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Code d'accès legacy (portail simple par code)
    code_acces: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, default=_gen_code
    )

    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="IMPORTE")

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    inscriptions = relationship("Inscription", back_populates="candidat")
    liste_attente = relationship("ListeAttente", back_populates="candidat")
    notes = relationship("Note", back_populates="candidat")
