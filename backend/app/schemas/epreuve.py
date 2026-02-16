from datetime import time
from typing import Optional
from pydantic import BaseModel, Field, field_validator

ALLOWED_STATUT = {
    "CREE",
    "LIBRE",
    "ATTRIBUEE",
    "EN_EVALUATION",
    "FINALISEE",
    "ANNULEE",
}


class EpreuveCreate(BaseModel):
    demi_journee_id: int
    matiere: str = Field(min_length=1, max_length=100)
    heure_debut: time
    heure_fin: time
    statut: str = "CREE"

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: str) -> str:
        if v not in ALLOWED_STATUT:
            raise ValueError(f"statut must be one of {sorted(ALLOWED_STATUT)}")
        return v

    @field_validator("heure_fin")
    @classmethod
    def validate_hours(cls, heure_fin: time, info):
        heure_debut = info.data.get("heure_debut")
        if heure_debut and not (heure_debut < heure_fin):
            raise ValueError("heure_debut must be < heure_fin")
        return heure_fin


class EpreuveOut(BaseModel):
    id: int
    demi_journee_id: int
    matiere: str
    heure_debut: time
    heure_fin: time
    statut: str

    class Config:
        from_attributes = True
