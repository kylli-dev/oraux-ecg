from datetime import time
from pydantic import BaseModel, Field, field_validator
from typing import List,  Optional

ALLOWED_STATUT = {"CREE", "LIBRE"}


class SkipRange(BaseModel):
    start: time
    end: time

    @field_validator("end")
    @classmethod
    def validate_range(cls, end: time, info):
        start = info.data.get("start")
        if start and not (start < end):
            raise ValueError("skip range start must be < end")
        return end


class GenerateEpreuvesIn(BaseModel):
    # Ancien format (rétro-compat)
    matiere: Optional[str] = None

    # Nouveau format (rotation)
    matieres: Optional[List[str]] = None

    duree_minutes: int = Field(ge=5, le=240)
    pause_minutes: int = Field(ge=0, le=120)
    statut_initial: str = "CREE"
    skip_ranges: List[SkipRange] = Field(default_factory=list)

    @field_validator("statut_initial")
    @classmethod
    def validate_statut(cls, v: str) -> str:
        if v not in ALLOWED_STATUT:
            raise ValueError(f"statut_initial must be one of {sorted(ALLOWED_STATUT)}")
        return v

    @field_validator("matieres")
    @classmethod
    def validate_matieres(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        clean = [m.strip() for m in v if m and m.strip()]
        if not clean:
            raise ValueError("matieres must contain at least one non-empty string")
        return clean

    @field_validator("matiere")
    @classmethod
    def validate_matiere(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("matiere cannot be empty")
        return v

    def resolved_matieres(self) -> List[str]:
        """Retourne toujours une liste de matières (nouveau format)."""
        if self.matieres and len(self.matieres) > 0:
            return self.matieres
        if self.matiere:
            return [self.matiere]
        raise ValueError("Either 'matiere' or 'matieres' is required")
