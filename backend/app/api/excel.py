"""
Import / Export Excel des plannings.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.services.excel import (
    export_planning, export_template, import_epreuves,
    import_candidats, export_template_candidats,
    import_candidats_complet, export_template_candidats_complet,
    import_examinateurs, export_template_examinateurs,
)

router = APIRouter(
    prefix="/admin/excel",
    tags=["excel"],
    dependencies=[Depends(require_admin)],
)


@router.get("/plannings/{planning_id}/export")
def export(planning_id: int, db: Session = Depends(get_db)):
    try:
        data = export_planning(db, planning_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=planning_{planning_id}.xlsx"},
    )


@router.get("/template")
def template():
    data = export_template()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_epreuves.xlsx"},
    )


@router.post("/plannings/{planning_id}/import")
def import_excel(
    planning_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Fichier Excel (.xlsx) requis")
    content = file.file.read()
    try:
        result = import_epreuves(db, planning_id, content)
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


# ── Candidats ─────────────────────────────────────────────────────────────────

@router.get("/candidats/template")
def template_candidats():
    data = export_template_candidats()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_candidats.xlsx"},
    )


@router.post("/plannings/{planning_id}/candidats/import")
def import_candidats_excel(
    planning_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Fichier Excel (.xlsx) requis")
    content = file.file.read()
    try:
        result = import_candidats(db, planning_id, content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.get("/candidats/template-complet")
def template_candidats_complet():
    """Télécharge le fichier modèle d'import candidats (18 champs concours)."""
    data = export_template_candidats_complet()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=modele_import_candidats.xlsx"},
    )


@router.post("/plannings/{planning_id}/candidats/import-complet")
def import_candidats_complet_excel(
    planning_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Importe les candidats depuis le template complet 18 colonnes."""
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Fichier Excel (.xlsx) requis")
    content = file.file.read()
    try:
        result = import_candidats_complet(db, planning_id, content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


# ── Examinateurs ──────────────────────────────────────────────────────────────

@router.get("/examinateurs/template")
def template_examinateurs():
    data = export_template_examinateurs()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_examinateurs.xlsx"},
    )


@router.post("/plannings/{planning_id}/examinateurs/import")
def import_examinateurs_excel(
    planning_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Fichier Excel (.xlsx) requis")
    content = file.file.read()
    try:
        result = import_examinateurs(db, planning_id, content)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
