from pydantic import BaseModel, Field, field_validator

ALLOWED_STATUT = {"CREE", "LIBRE"}

class GenerateEpreuvesIn(BaseModel):
    matiere: str = Field(min_length=1, max_length=100)
    duree_minutes: int = Field(ge=5, le=240)
    pause_minutes: int = Field(ge=0, le=120)
    statut_initial: str = "CREE"

    @field_validator("statut_initial")
    @classmethod
    def validate_statut(cls, v: str) -> str:
        if v not in ALLOWED_STATUT:
            raise ValueError(f"statut_initial must be one of {sorted(ALLOWED_STATUT)}")
        return v
