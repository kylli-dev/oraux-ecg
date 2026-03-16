from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr

class ExaminateurCreate(BaseModel):
    planning_id: int
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=255)
    matieres: List[str] = []

class ExaminateurUpdate(BaseModel):
    nom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    prenom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[str] = Field(default=None, min_length=1, max_length=255)
    matieres: Optional[List[str]] = None

class ExaminateurOut(BaseModel):
    id: int
    planning_id: int
    nom: str
    prenom: str
    email: str
    matieres: List[str]
    code_acces: str

    class Config:
        from_attributes = True

class AssignerExaminateurIn(BaseModel):
    examinateur_id: Optional[int] = None
