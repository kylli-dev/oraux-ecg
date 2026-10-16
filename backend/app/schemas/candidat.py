from datetime import datetime
import re
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


ALLOWED_STATUT = {"IMPORTE", "INSCRIT", "CONFIRME", "ANNULE"}


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_DATE_FR_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def _vide_en_none(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class CandidatFiche(BaseModel):
    """
    Informations saisissables d'un candidat (ajout manuel et modification). Le profil est
    obligatoire : sans lui (ni classe), le candidat se verrait proposer à la fois les
    triplets ESH et HGG.
    """
    nom: str = Field(min_length=1, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    profil: Literal["HGG", "ESH"]
    classe: Optional[str] = Field(default=None, max_length=50)
    civilite: Optional[Literal["M.", "Mme"]] = None
    code_candidat: Optional[str] = Field(default=None, max_length=50)
    numero_ine: Optional[str] = Field(default=None, max_length=20)
    date_naissance: Optional[str] = None  # « jj/mm/aaaa », comme à l'import
    tel_portable: Optional[str] = Field(default=None, max_length=30)
    qualite: Optional[Literal["Boursier", "Non boursier"]] = None
    handicape: bool = False
    code_uai: Optional[str] = Field(default=None, max_length=20)  # établissement du référentiel

    @field_validator("classe", "civilite", "code_candidat", "numero_ine", "date_naissance",
                     "tel_portable", "qualite", "code_uai", mode="before")
    @classmethod
    def _optionnels(cls, v):
        return _vide_en_none(v)

    @field_validator("nom", "prenom")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("ne peut pas être vide")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("adresse email invalide")
        return v

    @field_validator("date_naissance")
    @classmethod
    def _date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _DATE_FR_RE.match(v):
            raise ValueError("format attendu : jj/mm/aaaa")
        return v


class CandidatCreate(CandidatFiche):
    """Ajout manuel d'un candidat (hors import)."""
    planning_id: int
    envoyer_identifiants: bool = False  # email Message-type ADMISSIBILITE


class CandidatUpdate(CandidatFiche):
    """Modification de la fiche (onglet Candidats → Liste) : remplace toutes les informations."""


class CandidatOut(BaseModel):
    id: int
    planning_id: int
    nom: str
    prenom: str
    email: str
    code_acces: str
    statut: str
    created_at: datetime
    profil: Optional[str] = None
    classe: Optional[str] = None

    class Config:
        from_attributes = True


class CandidatDetailOut(CandidatOut):
    """Fiche complète, pour pré-remplir le formulaire de modification."""
    login: Optional[str] = None
    civilite: Optional[str] = None
    code_candidat: Optional[str] = None
    numero_ine: Optional[str] = None
    date_naissance: Optional[str] = None
    tel_portable: Optional[str] = None
    qualite: Optional[str] = None
    handicape: Optional[bool] = None
    code_uai: Optional[str] = None
    etablissement: Optional[str] = None


class CandidatCreateOut(CandidatOut):
    """Réponse de création : le mot de passe provisoire n'est montré qu'une seule fois."""
    login: str
    password_provisoire: str
    email_identifiants_envoye: bool = False


class AssignerCandidatIn(BaseModel):
    candidat_id: Optional[int] = None  # None = désassigner
