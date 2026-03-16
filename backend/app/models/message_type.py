from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class MessageType(Base):
    """
    Template d'email paramétrable par le service des admissions.

    Codes prédéfinis :
      ADMISSIBILITE  — envoyé lors de l'injection du candidat (login + mdp)
      CONVOCATION    — envoyé lors de l'inscription à un triplet
      RAPPEL         — envoyé J-2 à 12h et J-1 à 12h
      DESINSCRIPTION — envoyé lors de l'annulation d'inscription
      LISTE_ATTENTE  — envoyé lors de l'enregistrement sur liste d'attente
      PUBLICATION_NOTES — envoyé lors de la publication des notes
    """

    __tablename__ = "message_type"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Identifiant métier unique (ADMISSIBILITE, CONVOCATION, etc.)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    sujet: Mapped[str] = mapped_column(String(500), nullable=False, default="")

    # Corps du message (HTML ou texte, éditable par le service des admissions)
    corps_html: Mapped[str] = mapped_column(Text, nullable=False, default="")

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
