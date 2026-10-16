from datetime import datetime, date as _date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.inscription import InscriptionEpreuve
from app.models.planning_salle_defaut import PlanningMatiereSalleDefaut
from app.schemas.epreuve import EpreuveCreate, EpreuveOut, EpreuveUpdate
from app.services.inscriptions import annuler_inscriptions_orphelines


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
            if defaut.surveillant2_id is not None:
                e.surveillant2_id = defaut.surveillant2_id

    db.commit()
    db.refresh(e)
    return e


class DupliquerTripletIn(BaseModel):
    epreuve_ids: List[int]


@router.post("/dupliquer-triplet", response_model=List[EpreuveOut], status_code=201)
def dupliquer_triplet(body: DupliquerTripletIn, db: Session = Depends(get_db)):
    """
    Ajoute un triplet en parallèle d'un triplet existant : une copie LIBRE de chacune de ses
    épreuves (même demi-journée, matière, horaires, préparation). Les heures de la journée
    restent inchangées, donc la rotation qui forme les triplets n'est pas recalculée — c'est
    pourquoi on n'autorise plus l'ajout d'une épreuve isolée à une heure quelconque.
    La salle d'examen est laissée vide : une copie dans la même salle ne compterait pas comme
    une place supplémentaire (voir _partition_par_profil) — l'admin en attribue une autre.
    Tout ou rien : les copies sont créées dans une seule transaction.
    """
    ids = list(dict.fromkeys(body.epreuve_ids))
    if len(ids) < 2:
        raise HTTPException(status_code=422, detail="Un triplet comporte au moins 2 épreuves")
    originaux = db.query(Epreuve).filter(Epreuve.id.in_(ids)).all()
    if len(originaux) != len(ids):
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    djs = {e.demi_journee_id: db.get(DemiJournee, e.demi_journee_id) for e in originaux}
    if len({(dj.planning_id, dj.date) for dj in djs.values()}) != 1:
        raise HTTPException(status_code=422, detail="Les épreuves d'un triplet doivent être du même planning et du même jour")
    if len({e.matiere for e in originaux}) != len(originaux):
        raise HTTPException(status_code=422, detail="Un triplet ne peut pas contenir deux fois la même matière")

    copies = []
    for o in originaux:
        c = Epreuve(
            demi_journee_id=o.demi_journee_id,
            matiere=o.matiere,
            heure_debut=o.heure_debut,
            heure_fin=o.heure_fin,
            preparation_minutes=o.preparation_minutes,
            salle_preparation_id=o.salle_preparation_id,
            statut="LIBRE",
        )
        db.add(c)
        copies.append(c)
    db.commit()
    for c in copies:
        db.refresh(c)
    return sorted(copies, key=lambda c: c.heure_debut)


@router.post("/supprimer-triplet")
def supprimer_triplet(body: DupliquerTripletIn, db: Session = Depends(get_db)):
    """
    Inverse de dupliquer-triplet : retire UN triplet en parallèle de celui indiqué. Pour
    chacune de ses (matière, heure), supprime l'épreuve parallèle la plus récente qui est
    LIBRE, sans candidat, sans planche et hors de toute inscription — et seulement s'il en
    reste au moins une autre à cette heure : les heures de la journée ne changent donc pas
    et la rotation des triplets n'est pas recalculée. Tout ou rien.
    """
    ids = list(dict.fromkeys(body.epreuve_ids))
    modeles = db.query(Epreuve).filter(Epreuve.id.in_(ids)).all()
    if len(ids) < 2 or len(modeles) != len(ids):
        raise HTTPException(status_code=422, detail="Triplet introuvable")
    djs = {e.demi_journee_id: db.get(DemiJournee, e.demi_journee_id) for e in modeles}
    jours = {(dj.planning_id, dj.date) for dj in djs.values()}
    if len(jours) != 1:
        raise HTTPException(status_code=422, detail="Les épreuves d'un triplet doivent être du même planning et du même jour")
    planning_id, jour = jours.pop()

    inscrites = {row[0] for row in db.query(InscriptionEpreuve.epreuve_id).all()}
    a_supprimer = []
    for m in modeles:
        paralleles = (
            db.query(Epreuve).join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
            .filter(
                DemiJournee.planning_id == planning_id, DemiJournee.date == jour,
                Epreuve.matiere == m.matiere, Epreuve.heure_debut == m.heure_debut,
            )
            .order_by(Epreuve.id.desc())
            .all()
        )
        supprimable = next((
            e for e in paralleles
            if e.statut == "LIBRE" and e.candidat_id is None and e.planche_id is None and e.id not in inscrites
        ), None) if len(paralleles) >= 2 else None
        if supprimable is None:
            raise HTTPException(
                status_code=422,
                detail=f"{m.matiere} {str(m.heure_debut)[:5]} : aucune épreuve en parallèle libre à supprimer "
                       "(il doit rester au moins une épreuve à cette heure, et celle supprimée doit être libre, sans candidat ni planche)",
            )
        a_supprimer.append(supprimable)

    for e in a_supprimer:
        db.delete(e)
    annuler_inscriptions_orphelines(db)
    db.commit()
    return {"supprimees": len(a_supprimer)}


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
    annuler_inscriptions_orphelines(db)
    db.commit()
