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

from app.models.demi_journee import DemiJournee

from app.models.demi_journee import DemiJournee
from app.schemas.demi_journee import DemiJourneeCreate, DemiJourneeOut, DemiJourneeUpdate
from app.models.planning import Planning

from typing import List
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.models.epreuve import Epreuve
from app.schemas.epreuve import EpreuveCreate, EpreuveOut

from sqlalchemy import and_

from app.schemas.epreuve import ALLOWED_STATUT 

from datetime import datetime, date, timedelta
from app.schemas.generation import GenerateEpreuvesIn
from app.models.demi_journee import DemiJournee



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

from typing import List
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError


@app.post("/admin/demi-journees", response_model=DemiJourneeOut, dependencies=[Depends(require_admin)])
def create_demi_journee(payload: DemiJourneeCreate, db: Session = Depends(get_db)):
    planning = db.get(Planning, payload.planning_id)
    if planning is None:
        raise HTTPException(status_code=404, detail="Planning not found")

    # Validation métier : date dans le planning
    if not (planning.date_debut <= payload.date <= planning.date_fin):
        raise HTTPException(status_code=422, detail="date must be within planning range")

    demi = DemiJournee(**payload.model_dump())
    db.add(demi)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Demi-journee already exists for this planning/date/type")

    db.refresh(demi)
    return demi


@app.get("/admin/demi-journees", response_model=List[DemiJourneeOut], dependencies=[Depends(require_admin)])
def list_demi_journees(planning_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(DemiJournee)
    if planning_id is not None:
        q = q.filter(DemiJournee.planning_id == planning_id)
    return q.order_by(DemiJournee.date.asc(), DemiJournee.type.asc()).all()


@app.patch("/admin/demi-journees/{demi_id}", response_model=DemiJourneeOut, dependencies=[Depends(require_admin)])
def update_demi_journee(demi_id: int, payload: DemiJourneeUpdate, db: Session = Depends(get_db)):
    demi = db.get(DemiJournee, demi_id)
    if demi is None:
        raise HTTPException(status_code=404, detail="Demi-journee not found")

    data = payload.model_dump(exclude_unset=True)

    # Re-valider heures si partiellement modifiées
    new_start = data.get("heure_debut", demi.heure_debut)
    new_end = data.get("heure_fin", demi.heure_fin)
    if not (new_start < new_end):
        raise HTTPException(status_code=422, detail="heure_debut must be < heure_fin")

    # Re-valider date dans planning si date modifiée
    if "date" in data:
        planning = db.get(Planning, demi.planning_id)
        if not (planning.date_debut <= data["date"] <= planning.date_fin):
            raise HTTPException(status_code=422, detail="date must be within planning range")

    for k, v in data.items():
        setattr(demi, k, v)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Demi-journee already exists for this planning/date/type")

    db.refresh(demi)
    return demi


@app.delete("/admin/demi-journees/{demi_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_demi_journee(demi_id: int, db: Session = Depends(get_db)):
    demi = db.get(DemiJournee, demi_id)
    if demi is None:
        raise HTTPException(status_code=404, detail="Demi-journee not found")

    db.delete(demi)
    db.commit()
    return

@app.post("/admin/epreuves", response_model=EpreuveOut, dependencies=[Depends(require_admin)])
def create_epreuve(payload: EpreuveCreate, db: Session = Depends(get_db)):

    # Vérifier chevauchement dans la même demi-journée
    overlap = db.query(Epreuve).filter(
        Epreuve.demi_journee_id == payload.demi_journee_id,
        and_(
            Epreuve.heure_debut < payload.heure_fin,
            Epreuve.heure_fin > payload.heure_debut
        )
    ).first()

    if overlap:
        raise HTTPException(status_code=409, detail="Time slot overlaps with existing epreuve")

    epreuve = Epreuve(**payload.model_dump())
    db.add(epreuve)
    db.commit()
    db.refresh(epreuve)
    return epreuve


@app.get("/admin/epreuves", response_model=list[EpreuveOut], dependencies=[Depends(require_admin)])
def list_epreuves(demi_journee_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Epreuve)
    if demi_journee_id is not None:
        q = q.filter(Epreuve.demi_journee_id == demi_journee_id)
    return q.all()


ALLOWED_TRANSITIONS = {
    "CREE": {"LIBRE", "ANNULEE"},
    "LIBRE": {"ATTRIBUEE", "ANNULEE"},
    "ATTRIBUEE": {"EN_EVALUATION", "LIBRE", "ANNULEE"},
    "EN_EVALUATION": {"FINALISEE"},
    "FINALISEE": set(),
    "ANNULEE": set(),
}

ALLOWED_STATUT = {"CREE", "LIBRE", "ATTRIBUEE", "EN_EVALUATION", "FINALISEE", "ANNULEE"}

@app.patch("/admin/epreuves/{epreuve_id}/statut", response_model=EpreuveOut, dependencies=[Depends(require_admin)])
def update_epreuve_statut(epreuve_id: int, new_statut: str, db: Session = Depends(get_db)):

    epreuve = db.get(Epreuve, epreuve_id)
    if not epreuve:
        raise HTTPException(status_code=404, detail="Epreuve not found")

    if new_statut not in ALLOWED_STATUT:
        raise HTTPException(status_code=422, detail="Invalid statut")

    if new_statut not in ALLOWED_TRANSITIONS.get(epreuve.statut, set()):
        raise HTTPException(status_code=409, detail="Transition not allowed")

    epreuve.statut = new_statut
    db.commit()
    db.refresh(epreuve)
    return epreuve


@app.post("/admin/demi-journees/{demi_id}/generate-epreuves", dependencies=[Depends(require_admin)])
def generate_epreuves(demi_id: int, payload: GenerateEpreuvesIn, db: Session = Depends(get_db)):
    demi = db.get(DemiJournee, demi_id)
    if demi is None:
        raise HTTPException(status_code=404, detail="Demi-journee not found")

    # construire des datetime pour itérer
    start_dt = datetime.combine(demi.date, demi.heure_debut)
    end_dt = datetime.combine(demi.date, demi.heure_fin)

    slot = timedelta(minutes=payload.duree_minutes)
    pause = timedelta(minutes=payload.pause_minutes)

    created = 0
    t = start_dt

    while t + slot <= end_dt:
        heure_debut = (t.time())
        heure_fin = ((t + slot).time())

        # anti-chevauchement (normalement inutile si on génère proprement, mais safe)
        overlap = db.query(Epreuve).filter(
            Epreuve.demi_journee_id == demi_id,
            Epreuve.heure_debut < heure_fin,
            Epreuve.heure_fin > heure_debut
        ).first()

        if overlap:
            raise HTTPException(status_code=409, detail="Generation would overlap existing epreuves")

        epreuve = Epreuve(
            demi_journee_id=demi_id,
            matiere=payload.matiere,
            heure_debut=heure_debut,
            heure_fin=heure_fin,
            statut=payload.statut_initial
        )
        db.add(epreuve)
        created += 1

        t = t + slot + pause

    db.commit()
    return {"demi_journee_id": demi_id, "created_epreuves": created}




