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


class EpreuveUpdate(BaseModel):
    statut: Optional[str] = None
    matiere: Optional[str] = Field(default=None, min_length=1, max_length=100)

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in ALLOWED_STATUT:
            raise ValueError(f"statut must be one of {sorted(ALLOWED_STATUT)}")
        return v


class EpreuveOut(BaseModel):
    id: int
    demi_journee_id: int
    matiere: str
    heure_debut: time
    heure_fin: time
    statut: str
    preparation_minutes: Optional[int] = None
    candidat_id: Optional[int] = None
    candidat_nom: Optional[str] = None
    candidat_prenom: Optional[str] = None
    examinateur_id: Optional[int] = None
    examinateur_nom: Optional[str] = None
    examinateur_prenom: Optional[str] = None

    class Config:
        from_attributes = True
