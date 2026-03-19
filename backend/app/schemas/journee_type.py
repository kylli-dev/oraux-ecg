from datetime import time
from typing import List
from pydantic import BaseModel, Field


class JourneeTypeCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    duree_defaut_minutes: int = Field(ge=5, le=240)
    pause_defaut_minutes: int = Field(ge=0, le=120)
    preparation_defaut_minutes: int = Field(ge=0, le=120, default=0)
    statut_initial: str = "CREE"


class JourneeTypeOut(BaseModel):
    id: int
    nom: str
    duree_defaut_minutes: int
    pause_defaut_minutes: int
    preparation_defaut_minutes: int
    statut_initial: str

    class Config:
        from_attributes = True


# ── Schémas de prévisualisation ───────────────────────────────────────────────

class BlocParamsOut(BaseModel):
    """Paramètres effectifs d'un bloc après résolution des valeurs par défaut."""
    heure_debut: time
    heure_fin: time
    matieres: List[str]
    duree_minutes: int
    pause_minutes: int
    preparation_minutes: int


class PeriodePlanOut(BaseModel):
    """Plan de génération pour une demi-journée (MATIN ou APRES_MIDI)."""
    type_dj: str
    heure_debut: time
    heure_fin: time
    blocs: List[BlocParamsOut]


class JourneeTypePreviewOut(BaseModel):
    """
    Résultat de la prévisualisation d'un gabarit.
    Décrit ce qui sera généré sans toucher à la base de données.
    """
    journee_type_id: int
    periodes: List[PeriodePlanOut]
