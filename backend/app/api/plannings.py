from datetime import date as Date
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.candidat import Candidat
from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.journee_type import JourneeType
from app.models.planning import Planning
from app.schemas.apply_journee_type import ApplyJourneeTypeIn
from app.schemas.day_view import DayDemiJourneeOut, DayEpreuveOut, DayViewOut
from app.schemas.epreuve import EpreuveUpdate
from app.schemas.planning import PlanningCreate, PlanningOut, PlanningUpdate
from app.services.excel import export_planning, export_template, import_epreuves
from app.services.generation import apply_journee_type

router = APIRouter(
    prefix="/admin/plannings",
    tags=["plannings"],
    dependencies=[Depends(require_admin)],
)


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PlanningOut])
def list_plannings(db: Session = Depends(get_db)):
    return db.query(Planning).order_by(Planning.id).all()


@router.post("/", response_model=PlanningOut, status_code=201)
def create_planning(body: PlanningCreate, db: Session = Depends(get_db)):
    planning = Planning(**body.model_dump())
    db.add(planning)
    db.commit()
    db.refresh(planning)
    return planning


@router.get("/{planning_id}", response_model=PlanningOut)
def get_planning(planning_id: int, db: Session = Depends(get_db)):
    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")
    return p


@router.put("/{planning_id}", response_model=PlanningOut)
def update_planning(planning_id: int, body: PlanningUpdate, db: Session = Depends(get_db)):
    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{planning_id}", status_code=204)
def delete_planning(planning_id: int, db: Session = Depends(get_db)):
    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")
    db.delete(p)
    db.commit()


# ── Statut ────────────────────────────────────────────────────────────────────

TRANSITIONS = {
    "BROUILLON": ["OUVERT"],
    "OUVERT":    ["BROUILLON", "CLOS"],
    "CLOS":      ["OUVERT"],
}

@router.post("/{planning_id}/statut")
def changer_statut(planning_id: int, body: dict, db: Session = Depends(get_db)):
    """Change le statut du planning. Transitions autorisées : BROUILLON↔OUVERT, OUVERT↔CLOS."""
    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")
    nouveau = body.get("statut", "").upper()
    if nouveau not in TRANSITIONS.get(p.statut, []):
        raise HTTPException(
            status_code=422,
            detail=f"Transition {p.statut} → {nouveau} non autorisée",
        )
    p.statut = nouveau
    db.commit()
    db.refresh(p)
    return {"id": p.id, "statut": p.statut}


# ── Génération ────────────────────────────────────────────────────────────────

@router.post("/{planning_id}/apply-journee-type")
def apply_jt(planning_id: int, body: ApplyJourneeTypeIn, db: Session = Depends(get_db)):
    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")
    jt = db.get(JourneeType, body.journee_type_id)
    if not jt:
        raise HTTPException(status_code=404, detail="JourneeType not found")
    if not (p.date_debut <= body.date <= p.date_fin):
        raise HTTPException(
            status_code=422,
            detail=f"date must be within planning range [{p.date_debut}, {p.date_fin}]",
        )
    result = apply_journee_type(db, planning_id, jt, body.date)
    return {"planning_id": planning_id, "date": body.date, **result}


# ── Liste épreuves d'un planning ──────────────────────────────────────────────

@router.get("/{planning_id}/epreuves")
def list_epreuves_planning(planning_id: int, db: Session = Depends(get_db)):
    """Retourne toutes les épreuves d'un planning avec leur date et examinateur."""
    from app.models.examinateur import Examinateur as ExaminateurModel
    rows = (
        db.query(Epreuve, DemiJournee)
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(DemiJournee.planning_id == planning_id)
        .order_by(DemiJournee.date, Epreuve.heure_debut)
        .all()
    )
    result = []
    for epreuve, dj in rows:
        candidat = db.get(Candidat, epreuve.candidat_id) if epreuve.candidat_id else None
        examinateur = db.get(ExaminateurModel, epreuve.examinateur_id) if epreuve.examinateur_id else None
        result.append({
            "id": epreuve.id,
            "date": str(dj.date),
            "demi_journee_type": dj.type,
            "matiere": epreuve.matiere,
            "heure_debut": str(epreuve.heure_debut)[:5],
            "heure_fin": str(epreuve.heure_fin)[:5],
            "statut": epreuve.statut,
            "candidat_id": candidat.id if candidat else None,
            "candidat_nom": candidat.nom if candidat else None,
            "candidat_prenom": candidat.prenom if candidat else None,
            "examinateur_id": examinateur.id if examinateur else None,
            "examinateur_nom": examinateur.nom if examinateur else None,
            "examinateur_prenom": examinateur.prenom if examinateur else None,
        })
    return result


# ── Modification épreuve ───────────────────────────────────────────────────────

@router.patch("/{planning_id}/epreuves/{epreuve_id}")
def patch_epreuve(
    planning_id: int,
    epreuve_id: int,
    body: EpreuveUpdate,
    db: Session = Depends(get_db),
):
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(e, field, value)
    db.commit()
    return {"epreuve_id": e.id, "statut": e.statut, "matiere": e.matiere}


# ── Import / Export Excel ──────────────────────────────────────────────────────

@router.get("/{planning_id}/export")
def export_excel(planning_id: int, db: Session = Depends(get_db)):
    """Télécharge un fichier Excel avec toutes les épreuves du planning."""
    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")
    xlsx_bytes = export_planning(db, planning_id)
    filename = f"planning_{planning_id}_{p.nom.replace(' ', '_')}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/template/import")
def download_template():
    """Télécharge un fichier Excel modèle pour l'import."""
    xlsx_bytes = export_template()
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="template_import.xlsx"'},
    )


@router.post("/{planning_id}/import")
async def import_excel(
    planning_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Importe des épreuves depuis un fichier Excel."""
    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=422, detail="Le fichier doit être au format .xlsx")
    content = await file.read()
    result = import_epreuves(db, planning_id, content)
    return {"planning_id": planning_id, **result}


# ── Vue journée ───────────────────────────────────────────────────────────────

@router.get("/{planning_id}/day", response_model=DayViewOut)
def day_view(planning_id: int, date: Date = Query(...), db: Session = Depends(get_db)):
    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")

    demi_journees = (
        db.query(DemiJournee)
        .filter_by(planning_id=planning_id, date=date)
        .order_by(DemiJournee.heure_debut)
        .all()
    )

    djs_out = []
    for dj in demi_journees:
        epreuves = (
            db.query(Epreuve)
            .filter_by(demi_journee_id=dj.id)
            .order_by(Epreuve.heure_debut)
            .all()
        )
        djs_out.append(
            DayDemiJourneeOut(
                id=dj.id,
                type=dj.type,
                heure_debut=dj.heure_debut,
                heure_fin=dj.heure_fin,
                epreuves=[
                    DayEpreuveOut(
                        id=e.id,
                        matiere=e.matiere,
                        heure_debut=e.heure_debut,
                        heure_fin=e.heure_fin,
                        statut=e.statut,
                        candidat_id=e.candidat_id,
                        candidat_nom=e.candidat.nom if e.candidat else None,
                        candidat_prenom=e.candidat.prenom if e.candidat else None,
                        examinateur_id=e.examinateur_id,
                        examinateur_nom=e.examinateur.nom if e.examinateur else None,
                        examinateur_prenom=e.examinateur.prenom if e.examinateur else None,
                    )
                    for e in epreuves
                ],
            )
        )

    return DayViewOut(planning_id=planning_id, date=date, demi_journees=djs_out)


# ── Tableau de bord ────────────────────────────────────────────────────────────

@router.get("/{planning_id}/dashboard")
def dashboard(planning_id: int, db: Session = Depends(get_db)):
    """Statistiques de pilotage d'un planning."""
    from datetime import date as Date
    from sqlalchemy import func as sqlfunc
    from app.models.candidat import Candidat
    from app.models.examinateur import Examinateur

    p = db.get(Planning, planning_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planning not found")

    # Stats épreuves par statut
    statuts_rows = (
        db.query(Epreuve.statut, sqlfunc.count(Epreuve.id))
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(DemiJournee.planning_id == planning_id)
        .group_by(Epreuve.statut)
        .all()
    )
    statuts = {s: c for s, c in statuts_rows}
    total_epreuves = sum(statuts.values())
    attribuees = statuts.get("ATTRIBUEE", 0)
    libres = statuts.get("LIBRE", 0)

    # Stats par matière
    matieres_rows = (
        db.query(Epreuve.matiere, sqlfunc.count(Epreuve.id))
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(DemiJournee.planning_id == planning_id)
        .group_by(Epreuve.matiere)
        .order_by(sqlfunc.count(Epreuve.id).desc())
        .all()
    )
    by_matiere = [{"matiere": m, "count": c} for m, c in matieres_rows]

    # Stats par date
    dates_rows = (
        db.query(DemiJournee.date, sqlfunc.count(Epreuve.id))
        .join(Epreuve, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(DemiJournee.planning_id == planning_id)
        .group_by(DemiJournee.date)
        .order_by(DemiJournee.date)
        .all()
    )
    by_date = [{"date": str(d), "count": c} for d, c in dates_rows]

    # Candidats
    total_candidats = db.query(Candidat).filter_by(planning_id=planning_id).count()
    candidats_avec_epreuve = (
        db.query(sqlfunc.count(sqlfunc.distinct(Epreuve.candidat_id)))
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(
            DemiJournee.planning_id == planning_id,
            Epreuve.candidat_id.isnot(None),
        )
        .scalar()
    ) or 0

    # Examinateurs
    total_examinateurs = db.query(Examinateur).filter_by(planning_id=planning_id).count()
    examinateurs_avec_epreuve = (
        db.query(sqlfunc.count(sqlfunc.distinct(Epreuve.examinateur_id)))
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(
            DemiJournee.planning_id == planning_id,
            Epreuve.examinateur_id.isnot(None),
        )
        .scalar()
    ) or 0

    taux_attribution = round(attribuees / total_epreuves * 100, 1) if total_epreuves else 0

    return {
        "planning_id": planning_id,
        "planning_nom": p.nom,
        "total_epreuves": total_epreuves,
        "by_statut": statuts,
        "taux_attribution": taux_attribution,
        "libres": libres,
        "attribuees": attribuees,
        "total_candidats": total_candidats,
        "candidats_avec_epreuve": candidats_avec_epreuve,
        "total_examinateurs": total_examinateurs,
        "examinateurs_avec_epreuve": examinateurs_avec_epreuve,
        "by_matiere": by_matiere,
        "by_date": by_date,
    }
