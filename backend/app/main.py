from fastapi import FastAPI
import os
from sqlalchemy import create_engine, text
from app.db.base import Base
from app.db.session import engine
from app.models import Planning  # important: force l'import du modèle


app = FastAPI(title="Oraux Platform")

@app.get("/")
def root():
    return {"service": "oraux-ecg", "status": "ok"}

@app.get("/health")
def health():
    return {"status": "ok"}

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL) if DATABASE_URL else None

@app.get("/db-check")
def db_check():
    if engine is None:
        return {"db": "missing DATABASE_URL"}
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"db": "ok"}

@app.on_event("startup")
def on_startup():
    if engine is not None:
        Base.metadata.create_all(bind=engine)
from sqlalchemy import text
from app.db.session import engine

@app.get("/planning-check")
def planning_check():
    if engine is None:
        return {"db": "missing DATABASE_URL"}
    with engine.connect() as conn:
        # Vérifie que la table existe en PostgreSQL
        r = conn.execute(text("SELECT to_regclass('public.planning')")).scalar()
    return {"planning_table": r}
