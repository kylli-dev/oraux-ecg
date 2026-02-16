from fastapi import FastAPI
from sqlalchemy import text

from app.db.base import Base
from app.db.session import engine
from app.models.planning import Planning

from typing import List
from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.planning import Planning
from app.schemas.planning import PlanningCreate, PlanningOut

app = FastAPI(title="Oraux Platform")


@app.on_event("startup")
def on_startup():
    # Crée les tables au démarrage (temporaire, remplacé plus tard par Alembic)
    if engine is not None:
        Base.metadata.create_all(bind=engine)


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


@app.get("/planning-check")
def planning_check():
    if engine is None:
        return {"db": "missing DATABASE_URL"}
    with engine.connect() as conn:
        r = conn.execute(text("SELECT to_regclass('public.planning')")).scalar()
    return {"planning_table": r}

@app.post("/admin/plannings", response_model=PlanningOut, dependencies=[Depends(require_admin)])
def create_planning(payload: PlanningCreate, db: Session = Depends(get_db)):
    planning = Planning(**payload.model_dump())
    db.add(planning)
    db.commit()
    db.refresh(planning)
    return planning


@app.get("/admin/plannings", response_model=List[PlanningOut], dependencies=[Depends(require_admin)])
def list_plannings(db: Session = Depends(get_db)):
    return db.query(Planning).order_by(Planning.id.desc()).all()

