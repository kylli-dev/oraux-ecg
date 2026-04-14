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
    ExaminateurPlanning,  # noqa: F401
    Surveillant,  # noqa: F401
    Planche,  # noqa: F401
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
from app.api.surveillants import router as surveillants_router
from app.api.planches import router as planches_router

app = FastAPI(title="Oraux Platform")

_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://oraux-tau.vercel.app",
        *_extra_origins,
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
app.include_router(surveillants_router)
app.include_router(planches_router)


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"service": "oraux-ecg", "status": "ok"}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}


@app.get("/run-migrations")
def run_migrations_endpoint():
    try:
        _run_migrations()
        return {"status": "done"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.get("/db-check")
def db_check():
    if engine is None:
        return {"db": "missing DATABASE_URL"}
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        cols = conn.execute(text(
            "SELECT column_name, is_nullable, data_type FROM information_schema.columns "
            "WHERE table_name='examinateur' ORDER BY ordinal_position"
        )).fetchall()
    return {"db": "ok", "examinateur_columns": [{"name": c[0], "nullable": c[1], "type": c[2]} for c in cols]}


def _run_migrations():
    """Ajoute les colonnes manquantes sans casser les données existantes."""
    migrations = [
        "ALTER TABLE journee_type ADD COLUMN preparation_defaut_minutes INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE journee_type_bloc ADD COLUMN preparation_minutes INTEGER",
        "ALTER TABLE journee_type_bloc ADD COLUMN salles_par_matiere INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE epreuve ADD COLUMN preparation_minutes INTEGER",
        "ALTER TABLE examinateur ADD COLUMN actif INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE examinateur ALTER COLUMN actif TYPE BOOLEAN USING actif::boolean",
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
        # Fix type mismatch: PostgreSQL needs BOOLEAN not INTEGER for handicape
        "ALTER TABLE candidat ALTER COLUMN handicape TYPE BOOLEAN USING handicape::boolean",
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
        # Second examiner slot
        "ALTER TABLE epreuve ADD COLUMN examinateur2_id INTEGER REFERENCES examinateur(id) ON DELETE SET NULL",
        # Planche (sujet PDF) assignée à une épreuve
        "ALTER TABLE epreuve ADD COLUMN planche_id INTEGER REFERENCES planche(id) ON DELETE SET NULL",
        # Note harmonisée + commentaire
        "ALTER TABLE note ADD COLUMN note_harmonisee DOUBLE PRECISION",
        "ALTER TABLE note ADD COLUMN commentaire VARCHAR(500)",
        # Disposition personnalisée des triplets dans la vue matricielle
        "ALTER TABLE journee_type_bloc ADD COLUMN custom_matrix_json TEXT",
        # Paramètres comportementaux du planning
        "ALTER TABLE planning ADD COLUMN envoyer_convocations BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE planning ADD COLUMN interdire_modification_candidat BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE planning ADD COLUMN interdire_changement_creneau BOOLEAN NOT NULL DEFAULT FALSE",
        # code_uai et code_acces sur examinateur et candidat
        "ALTER TABLE examinateur ADD COLUMN code_uai VARCHAR(20)",
        "ALTER TABLE examinateur ADD COLUMN code_acces VARCHAR(20)",
        "ALTER TABLE candidat ADD COLUMN code_uai VARCHAR(20)",
        "ALTER TABLE candidat ADD COLUMN code_acces VARCHAR(20)",
        "ALTER TABLE candidat ADD COLUMN profil VARCHAR(10)",
        # surveillant_id sur epreuve
        "ALTER TABLE epreuve ADD COLUMN surveillant_id INTEGER REFERENCES surveillant(id) ON DELETE SET NULL",
        # heure_previs sur planning
        "ALTER TABLE planning ADD COLUMN heure_previs TIME",
        # Examinateurs globaux : table de liaison examinateur ↔ planning
        "CREATE TABLE IF NOT EXISTS examinateur_planning (id SERIAL PRIMARY KEY, examinateur_id INTEGER NOT NULL REFERENCES examinateur(id) ON DELETE CASCADE, planning_id INTEGER NOT NULL REFERENCES planning(id) ON DELETE CASCADE, actif BOOLEAN NOT NULL DEFAULT TRUE, CONSTRAINT uq_ex_planning UNIQUE (examinateur_id, planning_id))",
        "INSERT INTO examinateur_planning (examinateur_id, planning_id, actif) SELECT id, planning_id, COALESCE(actif, TRUE) FROM examinateur WHERE planning_id IS NOT NULL ON CONFLICT (examinateur_id, planning_id) DO NOTHING",
        "ALTER TABLE examinateur DROP CONSTRAINT IF EXISTS examinateur_planning_id_fkey",
        "ALTER TABLE examinateur ALTER COLUMN planning_id DROP NOT NULL",
        "ALTER TABLE examinateur DROP COLUMN IF EXISTS planning_id",
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
