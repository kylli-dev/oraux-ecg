from fastapi import FastAPI
from sqlalchemy import text
from fastapi import Depends, HTTPException
from app.schemas.planning import PlanningCreate, PlanningOut, PlanningUpdate
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

import os

@app.get("/env-check", include_in_schema=False)
def env_check():
    return {
        "has_ADMIN_API_KEY": "ADMIN_API_KEY" in os.environ,
        "has_DATABASE_URL": "DATABASE_URL" in os.environ,
        "admin_key_len": len(os.environ.get("ADMIN_API_KEY", "")),
    }


@app.patch("/admin/plannings/{planning_id}", response_model=PlanningOut, dependencies=[Depends(require_admin)])
def update_planning(planning_id: int, payload: PlanningUpdate, db: Session = Depends(get_db)):
    planning = db.get(Planning, planning_id)
    if planning is None:
        raise HTTPException(status_code=404, detail="Planning not found")

    data = payload.model_dump(exclude_unset=True)

    # Validation métier cross-fields (si on modifie une des dates)
    new_date_debut = data.get("date_debut", planning.date_debut)
    new_date_fin = data.get("date_fin", planning.date_fin)
    if not (new_date_debut < new_date_fin):
        raise HTTPException(status_code=422, detail="date_debut must be < date_fin")

    new_open = data.get("date_ouverture_inscriptions", planning.date_ouverture_inscriptions)
    new_close = data.get("date_fermeture_inscriptions", planning.date_fermeture_inscriptions)
    if not (new_open < new_close):
        raise HTTPException(status_code=422, detail="date_ouverture_inscriptions must be < date_fermeture_inscriptions")

    for k, v in data.items():
        setattr(planning, k, v)

    db.commit()
    db.refresh(planning)
    return planning


@app.delete("/admin/plannings/{planning_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_planning(planning_id: int, db: Session = Depends(get_db)):
    planning = db.get(Planning, planning_id)
    if planning is None:
        raise HTTPException(status_code=404, detail="Planning not found")

    # Garde-fou simple : si statut != BROUILLON, on interdit (évite de casser un planning en cours)
    if planning.statut != "BROUILLON":
        raise HTTPException(status_code=409, detail="Only BROUILLON plannings can be deleted")

    db.delete(planning)
    db.commit()
    return


