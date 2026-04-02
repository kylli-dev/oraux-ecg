from datetime import time
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


ALLOWED_BLOC_TYPE = {"GENERATION", "PAUSE"}


class MatiereConfigItem(BaseModel):
    """Durée et préparation propres à une matière."""
    nom: str
    duree_minutes: int = Field(ge=5, le=240)
    preparation_minutes: int = Field(ge=0, le=120)


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
    # Disposition personnalisée des triplets : None = réinitialiser à la formule N²
    custom_matrix: Optional[List[List[int]]] = None

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
    custom_matrix: Optional[List[List[int]]] = None

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
