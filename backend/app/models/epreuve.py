from sqlalchemy import Time, String, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Epreuve(Base):
    __tablename__ = "epreuve"

    id: Mapped[int] = mapped_column(primary_key=True)

    demi_journee_id: Mapped[int] = mapped_column(
        ForeignKey("demi_journee.id", ondelete="CASCADE"),
        nullable=False
    )

    matiere: Mapped[str] = mapped_column(String(100), nullable=False)

    heure_debut: Mapped[Time] = mapped_column(Time, nullable=False)
    heure_fin: Mapped[Time] = mapped_column(Time, nullable=False)

    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="CREE")

    __table_args__ = (
        CheckConstraint("heure_debut < heure_fin", name="chk_epreuve_hours"),
    )
