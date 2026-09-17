from datetime import time
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


ALLOWED_BLOC_TYPE = {"GENERATION", "PAUSE"}
ALLOWED_DJ_TYPE = {"MATIN", "APRES_MIDI"}


class MatiereConfigItem(BaseModel):
    """Durée, préparation et dédoublement de jury propres à une matière."""
    nom: str
    duree_minutes: int = Field(ge=5, le=240)
    preparation_minutes: int = Field(ge=0, le=120)
    # Nombre de salles en parallèle pour CETTE matière (dédoublement de jury sélectif) —
    # retombe sur salles_par_matiere (bloc) si absent, pour les gabarits existants.
    salles: Optional[int] = Field(default=None, ge=1, le=50)


class JourneeTypeBlocCreate(BaseModel):
    ordre: int = Field(ge=1, le=1000)
    type_bloc: str

    heure_debut: time
    heure_fin: time

    # Noms des matières (liste de strings — toujours requis pour GENERATION)
    matieres: Optional[List[str]] = None
    # Durées variables par matière (optionnel — remplace matieres si fourni)
    matieres_config: Optional[List[MatiereConfigItem]] = None

    # Paramètres globaux du bloc (fallback quand matieres_config absent)
    duree_minutes: Optional[int] = Field(default=None, ge=5, le=240)
    pause_minutes: Optional[int] = Field(default=None, ge=0, le=120)
    preparation_minutes: Optional[int] = Field(default=None, ge=0, le=120)
    salles_par_matiere: int = Field(default=1, ge=1, le=50)
    nb_slots: Optional[int] = Field(default=None, ge=1, le=10000)
    bonus_slots: int = Field(default=0, ge=0, le=1000)
    # Nature explicite (MATIN/APRES_MIDI) — None = déduite de heure_debut (comportement historique)
    type_demi_journee: Optional[str] = None

    @field_validator("type_bloc")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ALLOWED_BLOC_TYPE:
            raise ValueError(f"type_bloc must be one of {sorted(ALLOWED_BLOC_TYPE)}")
        return v

    @field_validator("type_demi_journee")
    @classmethod
    def validate_dj_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_DJ_TYPE:
            raise ValueError(f"type_demi_journee must be one of {sorted(ALLOWED_DJ_TYPE)} or None")
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
        return None


class JourneeTypeBlocUpdate(BaseModel):
    ordre: int = Field(ge=1, le=1000)
    heure_debut: time
    heure_fin: time
    matieres: Optional[List[str]] = None
    matieres_config: Optional[List[MatiereConfigItem]] = None
    duree_minutes: Optional[int] = Field(default=None, ge=5, le=240)
    pause_minutes: Optional[int] = Field(default=None, ge=0, le=120)
    preparation_minutes: Optional[int] = Field(default=None, ge=0, le=120)
    salles_par_matiere: int = Field(default=1, ge=1, le=50)
    nb_slots: Optional[int] = Field(default=None, ge=1, le=10000)
    bonus_slots: int = Field(default=0, ge=0, le=1000)
    # Disposition personnalisée des triplets : None = réinitialiser à la formule N²
    custom_matrix: Optional[List[List[int]]] = None
    # Nature explicite (MATIN/APRES_MIDI) — None = déduite de heure_debut (comportement historique)
    type_demi_journee: Optional[str] = None

    @field_validator("heure_fin")
    @classmethod
    def validate_hours(cls, heure_fin: time, info):
        start = info.data.get("heure_debut")
        if start and not (start < heure_fin):
            raise ValueError("heure_debut must be < heure_fin")
        return heure_fin

    @field_validator("matieres")
    @classmethod
    def clean_matieres(cls, v):
        if v is None:
            return []
        return [m.strip() for m in v if m and m.strip()]

    @field_validator("type_demi_journee")
    @classmethod
    def validate_dj_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_DJ_TYPE:
            raise ValueError(f"type_demi_journee must be one of {sorted(ALLOWED_DJ_TYPE)} or None")
        return v


class JourneeTypeBlocOut(BaseModel):
    id: int
    journee_type_id: int
    ordre: int
    type_bloc: str
    heure_debut: time
    heure_fin: time
    matieres: List[str]
    matieres_config: Optional[List[MatiereConfigItem]] = None
    duree_minutes: Optional[int]
    pause_minutes: Optional[int]
    preparation_minutes: Optional[int]
    salles_par_matiere: int
    nb_slots: Optional[int] = None
    bonus_slots: int = 0
    custom_matrix: Optional[List[List[int]]] = None
    type_demi_journee: Optional[str] = None

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def split_matieres_from_orm(cls, data):
        """
        L'ORM expose bloc.matieres qui peut être List[str] ou List[dict].
        Ce validator injecte matieres (noms) et matieres_config (dicts) séparément.
        """
        # Fonctionne aussi bien depuis un objet ORM que depuis un dict
        raw = None
        if hasattr(data, "matieres"):
            raw = data.matieres
        elif isinstance(data, dict) and "matieres" in data:
            raw = data["matieres"]

        if raw is None:
            return data

        has_dicts = any(isinstance(m, dict) for m in raw)

        names = [m["nom"] if isinstance(m, dict) else m for m in raw]
        config = [m for m in raw if isinstance(m, dict)] if has_dicts else None

        if isinstance(data, dict):
            data["matieres"] = names
            data["matieres_config"] = config
        else:
            # ORM object — convertir en dict pour Pydantic
            d = {c.key: getattr(data, c.key) for c in data.__table__.columns}
            d["matieres"] = names
            d["matieres_config"] = config
            # Exposer la propriété custom_matrix (désérialisée depuis JSON)
            d["custom_matrix"] = data.custom_matrix if hasattr(data, "custom_matrix") else None
            return d
        return data
