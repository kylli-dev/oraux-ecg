from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.base import Base
from app.db.session import engine

# Force l'import de tous les modèles avant create_all
from app.models import (  # noqa: F401
    Planning,
    DemiJournee,
    Candidat,
    Examinateur,
    Epreuve,
    JourneeType,
    JourneeTypeBloc,
    Inscription,
    InscriptionEpreuve,
    ListeAttente,
    Note,
    MessageType,
)

from app.api.plannings import router as plannings_router
from app.api.demi_journees import router as demi_journees_router
from app.api.journee_types import router as journee_types_router
from app.api.epreuves import router as epreuves_router
from app.api.candidats import router as candidats_router
from app.api.examinateurs import router as examinateurs_router
from app.api.portal import router as portal_router
from app.api.examinateur_portal import router as examinateur_portal_router
from app.api.conflits import router as conflits_router
from app.api.parametrages import router as parametrages_router
from app.api.notes import router as notes_router
from app.api.excel import router as excel_router

app = FastAPI(title="Oraux Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(plannings_router)
app.include_router(demi_journees_router)
app.include_router(journee_types_router)
app.include_router(epreuves_router)
app.include_router(candidats_router)
app.include_router(examinateurs_router)
app.include_router(portal_router)
app.include_router(examinateur_portal_router)
app.include_router(conflits_router)
app.include_router(parametrages_router)
app.include_router(notes_router)
app.include_router(excel_router)


@app.get("/")
def root():
    return {"service": "oraux-ecg", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    if engine is None:
        return {"db": "missing DATABASE_URL"}
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"db": "ok"}


def _run_migrations():
    """Ajoute les colonnes manquantes sans casser les données existantes."""
    migrations = [
        "ALTER TABLE journee_type ADD COLUMN preparation_defaut_minutes INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE journee_type_bloc ADD COLUMN preparation_minutes INTEGER",
        "ALTER TABLE epreuve ADD COLUMN preparation_minutes INTEGER",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()


@app.on_event("startup")
def on_startup():
    if engine is not None:
        Base.metadata.create_all(bind=engine)
        _run_migrations()
