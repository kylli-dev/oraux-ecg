from datetime import date, time
from typing import List
from pydantic import BaseModel


class DayEpreuveOut(BaseModel):
    id: int
    matiere: str
    heure_debut: time
    heure_fin: time
    statut: str

    class Config:
        from_attributes = True


class DayDemiJourneeOut(BaseModel):
    id: int
    type: str
    heure_debut: time
    heure_fin: time
    epreuves: List[DayEpreuveOut]


class DayViewOut(BaseModel):
    planning_id: int
    date: date
    demi_journees: List[DayDemiJourneeOut]
