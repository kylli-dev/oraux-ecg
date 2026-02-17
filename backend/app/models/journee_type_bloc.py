import json
from sqlalchemy import String, Integer, Time, ForeignKey, CheckConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class JourneeTypeBloc(Base):
    __tablename__ = "journee_type_bloc"

    id: Mapped[int] = mapped_column(primary_key=True)
    journee_type_id: Mapped[int] = mapped_column(ForeignKey("journee_type.id", ondelete="CASCADE"), nullable=False)

    ordre: Mapped[int] = mapped_column(Integer, nullable=False)

    type_bloc: Mapped[str] = mapped_column(String(20), nullable=False)  # GENERATION / PAUSE
    heure_debut: Mapped[str] = mapped_column(Time, nullable=False)
    heure_fin: Mapped[str] = mapped_column(Time, nullable=False)

    # JSON (liste de matières) seulement pour GENERATION
    matieres_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    # surcharge optionnelle des paramètres
    duree_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    pause_minutes: Mapped[int] = mapped_column(Integer, nullable=True)

    journee_type = relationship("JourneeType", back_populates="blocs")

    __table_args__ = (
        CheckConstraint("heure_debut < heure_fin", name="chk_jt_bloc_hours"),
    )

    @property
    def matieres(self):
        return json.loads(self.matieres_json or "[]")

    @matieres.setter
    def matieres(self, value):
        self.matieres_json = json.dumps(value or [])
