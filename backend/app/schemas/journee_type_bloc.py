from datetime import time
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


ALLOWED_BLOC_TYPE = {"GENERATION", "PAUSE"}

class JourneeTypeBlocCreate(BaseModel):
    ordre: int = Field(ge=1, le=1000)
    type_bloc: str

    heure_debut: time
    heure_fin: time

    # seulement pour GENERATION
    matieres: Optional[List[str]] = None

    # override optionnels
    duree_minutes: Optional[int] = Field(default=None, ge=5, le=240)
    pause_minutes: Optional[int] = Field(default=None, ge=0, le=120)

    @field_validator("type_bloc")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ALLOWED_BLOC_TYPE:
            raise ValueError(f"type_bloc must be one of {sorted(ALLOWED_BLOC_TYPE)}")
        return v

    @field_validator("heure_fin")
    @classmethod
    def validate_hours(cls, heure_fin: time, info):
        start = info.data.get("heure_debut")
        if start and not (start < heure_fin):
            raise ValueError("heure_debut must be < heure_fin")
        return heure_fin

    @field_validator("matieres")
    @classmethod
    def validate_matieres(cls, v, info):
        t = info.data.get("type_bloc")
        if t == "GENERATION":
            if not v or not any(m.strip() for m in v):
                raise ValueError("matieres is required for GENERATION bloc")
            return [m.strip() for m in v if m and m.strip()]
        # PAUSE: matieres doit être vide
        return None


class JourneeTypeBlocOut(BaseModel):
    id: int
    journee_type_id: int
    ordre: int
    type_bloc: str
    heure_debut: time
    heure_fin: time
    matieres: List[str]
    duree_minutes: Optional[int]
    pause_minutes: Optional[int]

    class Config:
        from_attributes = True
