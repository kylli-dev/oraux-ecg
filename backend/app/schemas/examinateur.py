from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ExaminateurCreate(BaseModel):
    planning_id: int
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=255)
    matieres: List[str] = []
    code_uai: Optional[str] = Field(default=None, max_length=20)
    etablissement: Optional[str] = Field(default=None, max_length=200)
    telephone: Optional[str] = Field(default=None, max_length=30)
    commentaire: Optional[str] = Field(default=None, max_length=1000)
    actif: bool = True


class ExaminateurUpdate(BaseModel):
    nom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    prenom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[str] = Field(default=None, min_length=1, max_length=255)
    matieres: Optional[List[str]] = None
    code_uai: Optional[str] = Field(default=None, max_length=20)
    etablissement: Optional[str] = Field(default=None, max_length=200)
    telephone: Optional[str] = Field(default=None, max_length=30)
    commentaire: Optional[str] = Field(default=None, max_length=1000)
    actif: Optional[bool] = None


class ExaminateurOut(BaseModel):
    id: int
    planning_id: int
    nom: str
    prenom: str
    email: str
    matieres: List[str]
    code_uai: Optional[str] = None
    etablissement: Optional[str] = None
    telephone: Optional[str] = None
    commentaire: Optional[str] = None
    actif: bool
    code_acces: str

    class Config:
        from_attributes = True


class AssignerExaminateurIn(BaseModel):
    examinateur_id: Optional[int] = None
    slot: int = 1  # 1 or 2


class AssignBulkIn(BaseModel):
    examinateur_id: int
    epreuve_ids: List[int]


class ConflictItem(BaseModel):
    epreuve_id: int
    reason: str
    date: str
    heure: str


class AssignBulkOut(BaseModel):
    assigned: List[int]
    conflicts: List[ConflictItem]


# ── Indisponibilités ──────────────────────────────────────────────────────────

class IndisponibiliteCreate(BaseModel):
    debut: datetime
    fin: datetime
    commentaire: Optional[str] = Field(default=None, max_length=500)


class IndisponibiliteUpdate(BaseModel):
    debut: Optional[datetime] = None
    fin: Optional[datetime] = None
    commentaire: Optional[str] = Field(default=None, max_length=500)


class IndisponibiliteOut(BaseModel):
    id: int
    examinateur_id: int
    debut: datetime
    fin: datetime
    commentaire: Optional[str] = None

    class Config:
        from_attributes = True
