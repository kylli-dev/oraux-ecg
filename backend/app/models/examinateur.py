import json
import secrets
from sqlalchemy import Boolean, String, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from app.db.base import Base

def _gen_code() -> str:
    return secrets.token_hex(4).upper()

class Examinateur(Base):
    __tablename__ = "examinateur"

    id: Mapped[int] = mapped_column(primary_key=True)
    planning_id: Mapped[int] = mapped_column(
        ForeignKey("planning.id", ondelete="CASCADE"), nullable=False
    )
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # JSON list of matieres this examiner can handle
    matieres_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    # Établissement (code UAI — saisie libre)
    code_uai: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    etablissement: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Contact
    telephone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    commentaire: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Statut mobilisable dans le planning
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Code for the examiner portal (public access)
    code_acces: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, default=_gen_code)

    @property
    def matieres(self):
        return json.loads(self.matieres_json or "[]")

    @matieres.setter
    def matieres(self, value):
        self.matieres_json = json.dumps(value or [])
