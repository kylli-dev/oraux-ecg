from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional


ALLOWED_STATUS = {"BROUILLON", "OUVERT", "CLOS"}

class PlanningCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=255)

    date_debut: date
    date_fin: date

    date_ouverture_inscriptions: datetime
    date_fermeture_inscriptions: datetime

    statut: str = "BROUILLON"

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str) -> str:
        if v not in ALLOWED_STATUS:
            raise ValueError(f"statut must be one of {sorted(ALLOWED_STATUS)}")
        return v

    @field_validator("date_fin")
    @classmethod
    def validate_dates_planning(cls, date_fin: date, info):
        date_debut = info.data.get("date_debut")
        if date_debut and not (date_debut < date_fin):
            raise ValueError("date_debut must be < date_fin")
        return date_fin

    @field_validator("date_fermeture_inscriptions")
    @classmethod
    def validate_dates_inscriptions(cls, fermeture: datetime, info):
        ouverture = info.data.get("date_ouverture_inscriptions")
        if ouverture and not (ouverture < fermeture):
            raise ValueError("date_ouverture_inscriptions must be < date_fermeture_inscriptions")
        return fermeture


class PlanningOut(BaseModel):
    id: int
    nom: str
    date_debut: date
    date_fin: date
    date_ouverture_inscriptions: datetime
    date_fermeture_inscriptions: datetime
    statut: str

    class Config:
        from_attributes = True


class PlanningUpdate(BaseModel):
    nom: Optional[str] = Field(default=None, min_length=1, max_length=255)
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    date_ouverture_inscriptions: Optional[datetime] = None
    date_fermeture_inscriptions: Optional[datetime] = None
    statut: Optional[str] = None

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in ALLOWED_STATUS:
            raise ValueError(f"statut must be one of {sorted(ALLOWED_STATUS)}")
        return v
