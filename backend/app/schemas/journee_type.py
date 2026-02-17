from pydantic import BaseModel, Field

class JourneeTypeCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=255)
    duree_defaut_minutes: int = Field(ge=5, le=240)
    pause_defaut_minutes: int = Field(ge=0, le=120)
    statut_initial: str = "CREE"


class JourneeTypeOut(BaseModel):
    id: int
    nom: str
    duree_defaut_minutes: int
    pause_defaut_minutes: int
    statut_initial: str

    class Config:
        from_attributes = True
