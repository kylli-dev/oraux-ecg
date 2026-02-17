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

from app.models.journee_type import JourneeType
from app.models.journee_type_bloc import JourneeTypeBloc

from app.schemas.journee_type import JourneeTypeCreate, JourneeTypeOut

from app.schemas.journee_type_bloc import JourneeTypeBlocCreate, JourneeTypeBlocOut

from datetime import datetime, timedelta
import json
from app.schemas.apply_journee_type import ApplyJourneeTypeIn
from app.models.journee_type import JourneeType
from app.models.journee_type_bloc import JourneeTypeBloc

from datetime import date as date_type
from app.schemas.day_view import DayViewOut, DayDemiJourneeOut, DayEpreuveOut




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

    matieres = payload.resolved_matieres()


    start_dt = datetime.combine(demi.date, demi.heure_debut)
    end_dt = datetime.combine(demi.date, demi.heure_fin)

    slot = timedelta(minutes=payload.duree_minutes)
    pause = timedelta(minutes=payload.pause_minutes)

    # convert skip ranges to datetime intervals
    skips: list[tuple[datetime, datetime]] = []
    for r in payload.skip_ranges:
        s = datetime.combine(demi.date, r.start)
        e = datetime.combine(demi.date, r.end)
        # si un skip range est hors de la demi-journée, on le tronque
        s = max(s, start_dt)
        e = min(e, end_dt)
        if s < e:
            skips.append((s, e))

    def in_skip(t: datetime) -> datetime | None:
        """Return end of skip interval if t is inside one, else None."""
        for s, e in skips:
            if s <= t < e:
                return e
        return None

    # index rotation matières
    i = 0
    created = 0
    t = start_dt

    # garde-fou: si des épreuves existent déjà, on empêche la génération (évite collisions)
    existing = db.query(Epreuve).filter(Epreuve.demi_journee_id == demi_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Epreuves already exist for this demi-journee")

    while t + slot <= end_dt:
        # sauter la pause si on est dedans
        skip_end = in_skip(t)
        if skip_end:
            t = skip_end
            continue

        heure_debut = t.time()
        heure_fin = (t + slot).time()

        # si le slot chevauche une pause (ex: commence avant 12:00 et finit après 12:00)
        # on avance à la fin de la pause
        slot_end = t + slot
        crossed = False
        for s, e in skips:
            if t < e and slot_end > s:  # overlap with skip
                t = e
                crossed = True
                break
        if crossed:
            continue

        matiere = matieres[i % len(matieres)]
        i += 1

        epreuve = Epreuve(
            demi_journee_id=demi_id,
            matiere=matiere,
            heure_debut=heure_debut,
            heure_fin=heure_fin,
            statut=payload.statut_initial,
        )
        db.add(epreuve)
        created += 1

        t = t + slot + pause

    db.commit()
    return {"demi_journee_id": demi_id, "created_epreuves": created, "matieres_rotation": matieres}



@app.get("/jt-check")
def jt_check():
    with engine.connect() as conn:
        r1 = conn.execute(text("SELECT to_regclass('public.journee_type')")).scalar()
        r2 = conn.execute(text("SELECT to_regclass('public.journee_type_bloc')")).scalar()
    return {"journee_type": r1, "journee_type_bloc": r2}


@app.post("/admin/journees-types", response_model=JourneeTypeOut, dependencies=[Depends(require_admin)])
def create_journee_type(payload: JourneeTypeCreate, db: Session = Depends(get_db)):
    jt = JourneeType(**payload.model_dump())
    db.add(jt)
    db.commit()
    db.refresh(jt)
    return jt


@app.post("/admin/journees-types/{jt_id}/blocs", response_model=JourneeTypeBlocOut, dependencies=[Depends(require_admin)])
def create_journee_type_bloc(jt_id: int, payload: JourneeTypeBlocCreate, db: Session = Depends(get_db)):
    jt = db.get(JourneeType, jt_id)
    if jt is None:
        raise HTTPException(status_code=404, detail="JourneeType not found")

    bloc = JourneeTypeBloc(
        journee_type_id=jt_id,
        ordre=payload.ordre,
        type_bloc=payload.type_bloc,
        heure_debut=payload.heure_debut,
        heure_fin=payload.heure_fin,
        duree_minutes=payload.duree_minutes,
        pause_minutes=payload.pause_minutes,
    )
    # stocker la liste dans matieres_json via le setter .matieres
    bloc.matieres = payload.matieres or []

    db.add(bloc)
    db.commit()
    db.refresh(bloc)
    return bloc

@app.get("/admin/journees-types/{jt_id}/blocs", response_model=list[JourneeTypeBlocOut], dependencies=[Depends(require_admin)])
def list_journee_type_blocs(jt_id: int, db: Session = Depends(get_db)):
    jt = db.get(JourneeType, jt_id)
    if jt is None:
        raise HTTPException(status_code=404, detail="JourneeType not found")

    return (
        db.query(JourneeTypeBloc)
        .filter(JourneeTypeBloc.journee_type_id == jt_id)
        .order_by(JourneeTypeBloc.ordre.asc())
        .all()
    )


@app.post("/admin/plannings/{planning_id}/apply-journee-type", dependencies=[Depends(require_admin)])
def apply_journee_type(planning_id: int, payload: ApplyJourneeTypeIn, db: Session = Depends(get_db)):
    planning = db.get(Planning, planning_id)
    if planning is None:
        raise HTTPException(status_code=404, detail="Planning not found")

    # date doit être dans le planning
    if not (planning.date_debut <= payload.date <= planning.date_fin):
        raise HTTPException(status_code=422, detail="date must be within planning range")

    jt = db.get(JourneeType, payload.journee_type_id)
    if jt is None:
        raise HTTPException(status_code=404, detail="JourneeType not found")

    blocs = (
        db.query(JourneeTypeBloc)
        .filter(JourneeTypeBloc.journee_type_id == jt.id)
        .order_by(JourneeTypeBloc.ordre.asc())
        .all()
    )
    if not blocs:
        raise HTTPException(status_code=422, detail="JourneeType has no blocs")

    # helper: obtenir / créer une demi-journée (MATIN ou APRES_MIDI) selon l'heure
    def get_or_create_demi(type_demi: str, heure_debut, heure_fin):
        demi = (
            db.query(DemiJournee)
            .filter(
                DemiJournee.planning_id == planning_id,
                DemiJournee.date == payload.date,
                DemiJournee.type == type_demi
            )
            .first()
        )
        if demi:
            return demi

        demi = DemiJournee(
            planning_id=planning_id,
            date=payload.date,
            type=type_demi,
            heure_debut=heure_debut,
            heure_fin=heure_fin
        )
        db.add(demi)
        db.flush()  # récupère demi.id sans commit
        return demi

    created_demi = 0
    created_epreuves = 0

    for bloc in blocs:
        # déterminer matin/aprem (simple règle)
        type_demi = "MATIN" if bloc.heure_debut < datetime.strptime("12:00:00", "%H:%M:%S").time() else "APRES_MIDI"

        demi = get_or_create_demi(type_demi, bloc.heure_debut, bloc.heure_fin)

        # si on vient de le créer
        # (flush l'a créé, mais on ne peut pas compter facilement sans flag, donc on check existence avant)
        # => on compte via existence initiale
        # plus simple: si aucune demi n'existait avant création
        # (on le gère hors helper)
        # Ici : on ne compte pas précisément, ce n'est pas critique. Optionnel.

        if bloc.type_bloc == "PAUSE":
            continue

        # paramètres par bloc (override sinon défaut)
        duree = bloc.duree_minutes if bloc.duree_minutes is not None else jt.duree_defaut_minutes
        pause = bloc.pause_minutes if bloc.pause_minutes is not None else jt.pause_defaut_minutes
        matieres = bloc.matieres  # via property JSON

        # garde-fou: pas de génération si déjà des épreuves sur ce demi
        existing = db.query(Epreuve).filter(Epreuve.demi_journee_id == demi.id).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Epreuves already exist for demi_journee {demi.id}")

        start_dt = datetime.combine(payload.date, bloc.heure_debut)
        end_dt = datetime.combine(payload.date, bloc.heure_fin)

        slot = timedelta(minutes=duree)
        pause_td = timedelta(minutes=pause)

        t = start_dt
        i = 0
        while t + slot <= end_dt:
            epreuve = Epreuve(
                demi_journee_id=demi.id,
                matiere=matieres[i % len(matieres)],
                heure_debut=t.time(),
                heure_fin=(t + slot).time(),
                statut=jt.statut_initial
            )
            db.add(epreuve)
            created_epreuves += 1
            i += 1
            t = t + slot + pause_td

    db.commit()
    return {"planning_id": planning_id, "date": str(payload.date), "journee_type_id": jt.id, "created_epreuves": created_epreuves}




@app.get("/admin/plannings/{planning_id}/day", response_model=DayViewOut, dependencies=[Depends(require_admin)])
def get_planning_day(planning_id: int, date: date_type, db: Session = Depends(get_db)):
    planning = db.get(Planning, planning_id)
    if planning is None:
        raise HTTPException(status_code=404, detail="Planning not found")

    # date doit être dans le planning
    if not (planning.date_debut <= date <= planning.date_fin):
        raise HTTPException(status_code=422, detail="date must be within planning range")

    demis = (
        db.query(DemiJournee)
        .filter(DemiJournee.planning_id == planning_id, DemiJournee.date == date)
        .order_by(DemiJournee.heure_debut.asc())
        .all()
    )

    demi_out = []
    for d in demis:
        epreuves = (
            db.query(Epreuve)
            .filter(Epreuve.demi_journee_id == d.id)
            .order_by(Epreuve.heure_debut.asc())
            .all()
        )
        demi_out.append(
            DayDemiJourneeOut(
                id=d.id,
                type=d.type,
                heure_debut=d.heure_debut,
                heure_fin=d.heure_fin,
                epreuves=[DayEpreuveOut.model_validate(e) for e in epreuves],
            )
        )

    return DayViewOut(planning_id=planning_id, date=date, demi_journees=demi_out)


