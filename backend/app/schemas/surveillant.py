from typing import Optional
from pydantic import BaseModel, Field


class SurveillantCreate(BaseModel):
    planning_id: int
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=255)
    actif: bool = True


class SurveillantUpdate(BaseModel):
    nom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    prenom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[str] = Field(default=None, min_length=1, max_length=255)
    actif: Optional[bool] = None


class SurveillantOut(BaseModel):
    id: int
    planning_id: int
    nom: str
    prenom: str
    email: str
    actif: bool
    code_acces: str

    class Config:
        from_attributes = True


class SurveillantCreatedOut(SurveillantOut):
    """Retourné uniquement à la création : inclut le mot de passe en clair."""
    plain_password: str
    email_sent: bool = False
