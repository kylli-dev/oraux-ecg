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
    Matiere,
    Salle,
    ExaminateurIndisponibilite,
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
from app.api.gestion_candidats import router as gestion_candidats_router

app = FastAPI(title="Oraux Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://oraux-tau.vercel.app",
    ],
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
app.include_router(gestion_candidats_router)


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"service": "oraux-ecg", "status": "ok"}


@app.api_route("/health", methods=["GET", "HEAD"])
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
        "ALTER TABLE journee_type_bloc ADD COLUMN salles_par_matiere INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE epreuve ADD COLUMN preparation_minutes INTEGER",
        "ALTER TABLE examinateur ADD COLUMN actif INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE examinateur ADD COLUMN etablissement VARCHAR(200)",
        "ALTER TABLE examinateur ADD COLUMN telephone VARCHAR(30)",
        "ALTER TABLE examinateur ADD COLUMN commentaire VARCHAR(1000)",
        # Candidat — champs import complet
        "ALTER TABLE candidat ADD COLUMN code_candidat VARCHAR(50)",
        "ALTER TABLE candidat ADD COLUMN numero_ine VARCHAR(20)",
        "ALTER TABLE candidat ADD COLUMN civilite VARCHAR(10)",
        "ALTER TABLE candidat ADD COLUMN date_naissance VARCHAR(20)",
        "ALTER TABLE candidat ADD COLUMN tel_portable VARCHAR(30)",
        "ALTER TABLE candidat ADD COLUMN qualite VARCHAR(50)",
        "ALTER TABLE candidat ADD COLUMN handicape INTEGER",
        "ALTER TABLE candidat ADD COLUMN cp VARCHAR(10)",
        "ALTER TABLE candidat ADD COLUMN ville VARCHAR(100)",
        "ALTER TABLE candidat ADD COLUMN libelle_pays VARCHAR(100)",
        "ALTER TABLE candidat ADD COLUMN classe VARCHAR(50)",
        "ALTER TABLE candidat ADD COLUMN etablissement VARCHAR(200)",
        "ALTER TABLE candidat ADD COLUMN ville_etablissement VARCHAR(100)",
        "ALTER TABLE candidat ADD COLUMN departement_etablissement VARCHAR(100)",
        # Salles sur épreuve
        "ALTER TABLE epreuve ADD COLUMN salle_id INTEGER REFERENCES salle(id) ON DELETE SET NULL",
        "ALTER TABLE epreuve ADD COLUMN salle_preparation_id INTEGER REFERENCES salle(id) ON DELETE SET NULL",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()


def _init_db():
    try:
        Base.metadata.create_all(bind=engine)
        _run_migrations()
        print("[startup] DB init OK", flush=True)
    except Exception as e:
        print(f"[startup] DB init error: {e}", flush=True)


@app.on_event("startup")
def on_startup():
    if engine is not None:
        import threading
        threading.Thread(target=_init_db, daemon=True).start()
