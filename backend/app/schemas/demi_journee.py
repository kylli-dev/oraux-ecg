from datetime import date, time
from typing import Optional
from pydantic import BaseModel, Field, field_validator

ALLOWED_TYPE = {"MATIN", "APRES_MIDI"}


class DemiJourneeCreate(BaseModel):
    planning_id: int

    date: date
    type: str = Field(...)

    heure_debut: time
    heure_fin: time

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ALLOWED_TYPE:
            raise ValueError(f"type must be one of {sorted(ALLOWED_TYPE)}")
        return v

    @field_validator("heure_fin")
    @classmethod
    def validate_hours(cls, heure_fin: time, info):
        heure_debut = info.data.get("heure_debut")
        if heure_debut and not (heure_debut < heure_fin):
            raise ValueError("heure_debut must be < heure_fin")
        return heure_fin


class DemiJourneeUpdate(BaseModel):
    date: Optional[date] = None
    type: Optional[str] = None
    heure_debut: Optional[time] = None
    heure_fin: Optional[time] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in ALLOWED_TYPE:
            raise ValueError(f"type must be one of {sorted(ALLOWED_TYPE)}")
        return v


class DemiJourneeOut(BaseModel):
    id: int
    planning_id: int
    date: date
    type: str
    heure_debut: time
    heure_fin: time

    class Config:
        from_attributes = True
