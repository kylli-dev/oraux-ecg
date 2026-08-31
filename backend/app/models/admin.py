from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Admin(Base):
    __tablename__ = "admin_user"

    id: Mapped[int] = mapped_column(primary_key=True)

    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # "admin" (par défaut) ou "super_admin" — seul un super_admin gère les comptes admin
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="admin")
    # True tant que le mot de passe a été défini par quelqu'un d'autre (création, réinitialisation,
    # amorçage) : force un changement de mot de passe à la prochaine connexion.
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
