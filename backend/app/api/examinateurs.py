from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.examinateur import Examinateur
from app.models.examinateur_indisponibilite import ExaminateurIndisponibilite
from app.models.examinateur_planning import ExaminateurPlanning
from app.models.epreuve import Epreuve
from app.models.demi_journee import DemiJournee
from app.schemas.examinateur import (
    ExaminateurCreate, ExaminateurOut, ExaminateurUpdate, AssignerExaminateurIn,
    IndisponibiliteCreate, IndisponibiliteUpdate, IndisponibiliteOut,
    AssignBulkIn, AssignBulkOut, ConflictItem,
)

router = APIRouter(
    prefix="/admin/examinateurs",
    tags=["examinateurs"],
    dependencies=[Depends(require_admin)],
)


# ── CRUD Examinateurs ─────────────────────────────────────────────────────────

@router.get("/", response_model=List[ExaminateurOut])
def list_examinateurs(planning_id: Optional[int] = None, db: Session = Depends(get_db)):
    examinateurs = db.query(Examinateur).order_by(Examinateur.nom, Examinateur.prenom).all()
    if not planning_id:
        return examinateurs
    # Enrichit chaque examinateur avec son statut pour ce planning
    liens = {
        ep.examinateur_id: ep.actif
        for ep in db.query(ExaminateurPlanning).filter_by(planning_id=planning_id).all()
    }
    result = []
    for ex in examinateurs:
        out = ExaminateurOut.model_validate(ex)
        out.actif_planning = liens.get(ex.id)  # None si non associé
        result.append(out)
    return result


@router.post("/", response_model=ExaminateurOut, status_code=201)
def create_examinateur(body: ExaminateurCreate, db: Session = Depends(get_db)):
    import traceback
    try:
        data = body.model_dump()
        matieres = data.pop("matieres")
        ex = Examinateur(**data)
        ex.matieres = matieres
        db.add(ex)
        db.commit()
        db.refresh(ex)
        return ex
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}\n{traceback.format_exc()}")


@router.get("/{examinateur_id}", response_model=ExaminateurOut)
def get_examinateur(examinateur_id: int, db: Session = Depends(get_db)):
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    return ex


@router.put("/{examinateur_id}", response_model=ExaminateurOut)
def update_examinateur(examinateur_id: int, body: ExaminateurUpdate, db: Session = Depends(get_db)):
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    data = body.model_dump(exclude_none=True)
    if "matieres" in data:
        ex.matieres = data.pop("matieres")
    for field, value in data.items():
        setattr(ex, field, value)
    db.commit()
    db.refresh(ex)
    return ex


@router.patch("/{examinateur_id}/plannings/{planning_id}", response_model=ExaminateurOut)
def set_actif_planning(examinateur_id: int, planning_id: int, body: dict, db: Session = Depends(get_db)):
    """Crée ou met à jour l'association examinateur ↔ planning avec le flag actif."""
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    actif = bool(body.get("actif", True))
    lien = db.query(ExaminateurPlanning).filter_by(
        examinateur_id=examinateur_id, planning_id=planning_id
    ).first()
    if lien:
        lien.actif = actif
    else:
        lien = ExaminateurPlanning(examinateur_id=examinateur_id, planning_id=planning_id, actif=actif)
        db.add(lien)
    db.commit()
    db.refresh(ex)
    out = ExaminateurOut.model_validate(ex)
    out.actif_planning = actif
    return out


@router.delete("/{examinateur_id}", status_code=204)
def delete_examinateur(examinateur_id: int, db: Session = Depends(get_db)):
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    db.query(Epreuve).filter_by(examinateur_id=examinateur_id).update({"examinateur_id": None})
    db.query(Epreuve).filter_by(examinateur2_id=examinateur_id).update({"examinateur2_id": None})
    db.delete(ex)
    db.commit()


# ── Affectation épreuve ───────────────────────────────────────────────────────

@router.post("/epreuves/{epreuve_id}/assigner")
def assigner_examinateur(epreuve_id: int, body: AssignerExaminateurIn, db: Session = Depends(get_db)):
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")
    if body.examinateur_id is None:
        # Deassign from specified slot
        if body.slot == 2:
            e.examinateur2_id = None
        else:
            e.examinateur_id = None
    else:
        ex = db.get(Examinateur, body.examinateur_id)
        if not ex:
            raise HTTPException(status_code=404, detail="Examinateur not found")
        if body.slot == 2:
            e.examinateur2_id = body.examinateur_id
        else:
            e.examinateur_id = body.examinateur_id
    db.commit()
    return {"epreuve_id": epreuve_id, "examinateur_id": e.examinateur_id, "examinateur2_id": e.examinateur2_id}


@router.post("/assign-bulk", response_model=AssignBulkOut)
def assign_bulk(body: AssignBulkIn, db: Session = Depends(get_db)):
    """Affecte un examinateur à plusieurs épreuves en vérifiant ses indisponibilités."""
    ex = db.get(Examinateur, body.examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")

    indispos = (
        db.query(ExaminateurIndisponibilite)
        .filter_by(examinateur_id=body.examinateur_id)
        .all()
    )

    assigned = []
    conflicts = []

    for epreuve_id in body.epreuve_ids:
        e = db.get(Epreuve, epreuve_id)
        if not e:
            continue
        dj = db.get(DemiJournee, e.demi_journee_id)
        if not dj:
            continue

        exam_start = datetime.combine(dj.date, e.heure_debut)
        exam_end = datetime.combine(dj.date, e.heure_fin)
        heure_str = f"{str(e.heure_debut)[:5]}–{str(e.heure_fin)[:5]}"
        date_str = str(dj.date)

        # Check indisponibilité
        conflict_found = False
        for ind in indispos:
            if exam_start < ind.fin and exam_end > ind.debut:
                conflicts.append(ConflictItem(
                    epreuve_id=epreuve_id,
                    reason="Indisponibilité",
                    date=date_str,
                    heure=heure_str,
                ))
                conflict_found = True
                break
        if conflict_found:
            continue

        # Already assigned to this examiner (either slot)
        if e.examinateur_id == body.examinateur_id or e.examinateur2_id == body.examinateur_id:
            assigned.append(epreuve_id)
            continue

        # Assign to available slot
        if e.examinateur_id is None:
            e.examinateur_id = body.examinateur_id
            assigned.append(epreuve_id)
        elif e.examinateur2_id is None:
            e.examinateur2_id = body.examinateur_id
            assigned.append(epreuve_id)
        else:
            conflicts.append(ConflictItem(
                epreuve_id=epreuve_id,
                reason="Créneau complet",
                date=date_str,
                heure=heure_str,
            ))

    db.commit()
    return AssignBulkOut(assigned=assigned, conflicts=conflicts)


# ── Indisponibilités ──────────────────────────────────────────────────────────

@router.get("/{examinateur_id}/indisponibilites", response_model=List[IndisponibiliteOut])
def list_indisponibilites(examinateur_id: int, db: Session = Depends(get_db)):
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    return (
        db.query(ExaminateurIndisponibilite)
        .filter_by(examinateur_id=examinateur_id)
        .order_by(ExaminateurIndisponibilite.debut)
        .all()
    )


@router.post("/{examinateur_id}/indisponibilites", response_model=IndisponibiliteOut, status_code=201)
def create_indisponibilite(
    examinateur_id: int, body: IndisponibiliteCreate, db: Session = Depends(get_db)
):
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    if body.fin <= body.debut:
        raise HTTPException(status_code=422, detail="La date de fin doit être après la date de début.")
    indispo = ExaminateurIndisponibilite(examinateur_id=examinateur_id, **body.model_dump())
    db.add(indispo)
    db.commit()
    db.refresh(indispo)
    return indispo


@router.put("/{examinateur_id}/indisponibilites/{indispo_id}", response_model=IndisponibiliteOut)
def update_indisponibilite(
    examinateur_id: int, indispo_id: int, body: IndisponibiliteUpdate, db: Session = Depends(get_db)
):
    indispo = db.get(ExaminateurIndisponibilite, indispo_id)
    if not indispo or indispo.examinateur_id != examinateur_id:
        raise HTTPException(status_code=404, detail="Indisponibilité introuvable")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(indispo, field, value)
    if indispo.fin <= indispo.debut:
        raise HTTPException(status_code=422, detail="La date de fin doit être après la date de début.")
    db.commit()
    db.refresh(indispo)
    return indispo


@router.delete("/{examinateur_id}/indisponibilites/{indispo_id}", status_code=204)
def delete_indisponibilite(
    examinateur_id: int, indispo_id: int, db: Session = Depends(get_db)
):
    indispo = db.get(ExaminateurIndisponibilite, indispo_id)
    if not indispo or indispo.examinateur_id != examinateur_id:
        raise HTTPException(status_code=404, detail="Indisponibilité introuvable")
    db.delete(indispo)
    db.commit()
