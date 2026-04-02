from datetime import datetime, date as _date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.planning_salle_defaut import PlanningMatiereSalleDefaut
from app.schemas.epreuve import EpreuveCreate, EpreuveOut, EpreuveUpdate


class SwapRowsIn(BaseModel):
    demi_journee_id: int
    slot_a: str   # "HH:MM" — heure_debut de la ligne A
    slot_b: str   # "HH:MM" — heure_debut de la ligne B

router = APIRouter(
    prefix="/admin/epreuves",
    tags=["epreuves"],
    dependencies=[Depends(require_admin)],
)


@router.post("/", response_model=EpreuveOut, status_code=201)
def create_epreuve(body: EpreuveCreate, db: Session = Depends(get_db)):
    e = Epreuve(**body.model_dump())
    db.add(e)
    db.flush()

    # Appliquer automatiquement la salle par défaut (planning × matière)
    dj = db.get(DemiJournee, e.demi_journee_id)
    if dj:
        defaut = db.query(PlanningMatiereSalleDefaut).filter_by(
            planning_id=dj.planning_id, matiere=e.matiere
        ).first()
        if defaut:
            if defaut.salle_id is not None:
                e.salle_id = defaut.salle_id
            if defaut.salle_preparation_id is not None:
                e.salle_preparation_id = defaut.salle_preparation_id
            if defaut.surveillant_id is not None:
                e.surveillant_id = defaut.surveillant_id

    db.commit()
    db.refresh(e)
    return e


@router.get("/{epreuve_id}", response_model=EpreuveOut)
def get_epreuve(epreuve_id: int, db: Session = Depends(get_db)):
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")
    return e


@router.put("/{epreuve_id}", response_model=EpreuveOut)
def update_epreuve(epreuve_id: int, body: EpreuveUpdate, db: Session = Depends(get_db)):
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")
    data = body.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return e


@router.post("/swap-rows")
def swap_triplet_rows(body: SwapRowsIn, db: Session = Depends(get_db)):
    """
    Échange atomique les horaires de deux lignes de triplet dans une demi-journée.
    Toutes les épreuves à slot_a prennent les heures de slot_b (et vice-versa).
    Les inscriptions candidats restent valides — elles pointent vers les mêmes
    épreuves, dont les horaires sont mis à jour.
    Retourne un avertissement si des candidats sont affectés dans l'une ou
    l'autre ligne (action non bloquante, Niveau 2).
    """
    def parse(s: str):
        h, m = s.split(":")
        return datetime.combine(_date(2000, 1, 1), __import__("datetime").time(int(h), int(m)))

    try:
        dt_a = parse(body.slot_a)
        dt_b = parse(body.slot_b)
    except Exception:
        raise HTTPException(status_code=422, detail="slot_a / slot_b doit être au format HH:MM")

    if body.slot_a == body.slot_b:
        return {"swapped": 0, "warning": None}

    eps_a = db.query(Epreuve).filter(
        Epreuve.demi_journee_id == body.demi_journee_id,
        Epreuve.heure_debut == dt_a.time(),
    ).all()

    eps_b = db.query(Epreuve).filter(
        Epreuve.demi_journee_id == body.demi_journee_id,
        Epreuve.heure_debut == dt_b.time(),
    ).all()

    if not eps_a and not eps_b:
        raise HTTPException(status_code=404, detail="Aucune épreuve trouvée pour ces créneaux")

    has_assigned_a = any(e.candidat_id is not None for e in eps_a)
    has_assigned_b = any(e.candidat_id is not None for e in eps_b)

    # Calcul du delta : déplacer row_A de (dt_b - dt_a), row_B de (dt_a - dt_b)
    delta = dt_b - dt_a  # timedelta

    for ep in eps_a:
        deb_dt = datetime.combine(_date(2000, 1, 1), ep.heure_debut) + delta
        fin_dt = datetime.combine(_date(2000, 1, 1), ep.heure_fin) + delta
        ep.heure_debut = deb_dt.time()
        ep.heure_fin = fin_dt.time()

    for ep in eps_b:
        deb_dt = datetime.combine(_date(2000, 1, 1), ep.heure_debut) - delta
        fin_dt = datetime.combine(_date(2000, 1, 1), ep.heure_fin) - delta
        ep.heure_debut = deb_dt.time()
        ep.heure_fin = fin_dt.time()

    db.commit()

    warning = None
    if has_assigned_a or has_assigned_b:
        warning = "Des candidats étaient affectés à ces créneaux — leurs horaires ont été mis à jour."

    return {"swapped": len(eps_a) + len(eps_b), "warning": warning}


@router.delete("/{epreuve_id}", status_code=204)
def delete_epreuve(epreuve_id: int, db: Session = Depends(get_db)):
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")
    db.delete(e)
    db.commit()
