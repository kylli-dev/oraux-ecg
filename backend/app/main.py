from fastapi import FastAPI
import os
from sqlalchemy import create_engine, text

app = FastAPI(title="Oraux ECG")

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
