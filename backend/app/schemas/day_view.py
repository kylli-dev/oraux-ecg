from datetime import date, time
from typing import List, Optional
from pydantic import BaseModel


class DayEpreuveOut(BaseModel):
    id: int
    matiere: str
    heure_debut: time
    heure_fin: time
    statut: str
    candidat_id: Optional[int] = None
    candidat_nom: Optional[str] = None
    candidat_prenom: Optional[str] = None
    examinateur_id: Optional[int] = None
    examinateur_nom: Optional[str] = None
    examinateur_prenom: Optional[str] = None
    preparation_minutes: Optional[int] = None
    salle_intitule: Optional[str] = None
    salle_preparation_intitule: Optional[str] = None

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
