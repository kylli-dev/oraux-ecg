from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


ALLOWED_STATUT = {"IMPORTE", "INSCRIT", "CONFIRME", "ANNULE"}


class CandidatCreate(BaseModel):
    planning_id: int
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=255)


class CandidatUpdate(BaseModel):
    nom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    prenom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[str] = Field(default=None, min_length=1, max_length=255)
    statut: Optional[str] = None


class CandidatOut(BaseModel):
    id: int
    planning_id: int
    nom: str
    prenom: str
    email: str
    code_acces: str
    statut: str
    created_at: datetime

    class Config:
        from_attributes = True


class AssignerCandidatIn(BaseModel):
    candidat_id: Optional[int] = None  # None = désassigner
