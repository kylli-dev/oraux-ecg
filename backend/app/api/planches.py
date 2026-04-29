"""
Gestion des planches (sujets PDF) et assignation aux épreuves.
Les fichiers PDF sont stockés directement en base (colonne BYTEA)
pour éviter la perte des fichiers sur les redémarrages Render.
"""
from __future__ import annotations

import io
import zipfile
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.epreuve import Epreuve
from app.models.examinateur import Examinateur
from app.models.matiere import Matiere
from app.models.planche import Planche

router = APIRouter(
    prefix="/admin/planches",
    tags=["planches"],
    dependencies=[Depends(require_admin)],
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class PlancheOut(BaseModel):
    id: int
    nom: str
    fichier_path: str
    matiere_id: Optional[int]
    matiere_intitule: Optional[str]
    examinateur_id: Optional[int]
    examinateur_nom: Optional[str]
    statut: str
    assignee: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PlancheUpdate(BaseModel):
    nom: Optional[str] = None
    matiere_id: Optional[int] = None
    examinateur_id: Optional[int] = None
    statut: Optional[str] = None


class AssignerPlancheIn(BaseModel):
    planche_id: int


# ── Helpers ──────────────────────────────────────────────────────────────────

def _is_assigned(planche_id: int, db: Session) -> bool:
    return db.query(Epreuve).filter(Epreuve.planche_id == planche_id).first() is not None


def _planche_out(p: Planche, db: Session) -> PlancheOut:
    matiere_intitule = None
    if p.matiere_id:
        m = db.get(Matiere, p.matiere_id)
        matiere_intitule = m.intitule if m else None

    examinateur_nom = None
    if p.examinateur_id:
        ex = db.get(Examinateur, p.examinateur_id)
        if ex:
            examinateur_nom = f"{ex.prenom} {ex.nom}".strip() if ex.prenom else ex.nom

    return PlancheOut(
        id=p.id,
        nom=p.nom,
        fichier_path=p.fichier_path,
        matiere_id=p.matiere_id,
        matiere_intitule=matiere_intitule,
        examinateur_id=p.examinateur_id,
        examinateur_nom=examinateur_nom,
        statut=p.statut,
        assignee=_is_assigned(p.id, db),
        created_at=p.created_at,
    )


def _get_pdf_bytes(p: Planche) -> bytes:
    """Retourne les bytes du PDF depuis la colonne BYTEA."""
    if not p.fichier_data:
        raise HTTPException(status_code=404, detail="Fichier introuvable (non stocké en base)")
    return p.fichier_data


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PlancheOut])
def list_planches(
    matiere_id: Optional[int] = None,
    statut: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Planche)
    if matiere_id:
        q = q.filter(Planche.matiere_id == matiere_id)
    if statut:
        q = q.filter(Planche.statut == statut.upper())
    planches = q.order_by(Planche.nom).all()
    return [_planche_out(p, db) for p in planches]


@router.post("/upload", response_model=List[PlancheOut], status_code=201)
async def upload_planches(
    files: List[UploadFile] = File(...),
    matiere_id: Optional[int] = Form(None),
    examinateur_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload d'un ou plusieurs PDFs — stocke les bytes directement en base."""
    result = []
    for upload in files:
        if not upload.filename or not upload.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"'{upload.filename}' n'est pas un PDF.")

        stem = Path(upload.filename).stem
        data = await upload.read()

        planche = Planche(
            nom=stem,
            fichier_path=upload.filename,  # conservé pour référence nom d'origine
            fichier_data=data,
            matiere_id=matiere_id,
            examinateur_id=examinateur_id,
            statut="ACTIF",
            created_at=datetime.utcnow(),
        )
        db.add(planche)
        db.flush()
        result.append(_planche_out(planche, db))

    db.commit()
    return result


@router.patch("/{planche_id}", response_model=PlancheOut)
def update_planche(planche_id: int, body: PlancheUpdate, db: Session = Depends(get_db)):
    p = db.get(Planche, planche_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planche introuvable")
    if body.nom is not None:
        p.nom = body.nom
    if body.matiere_id is not None:
        p.matiere_id = body.matiere_id
    if body.examinateur_id is not None:
        p.examinateur_id = body.examinateur_id
    if body.statut is not None:
        p.statut = body.statut.upper()
    db.commit()
    db.refresh(p)
    return _planche_out(p, db)


@router.delete("/{planche_id}", status_code=204)
def delete_planche(planche_id: int, db: Session = Depends(get_db)):
    p = db.get(Planche, planche_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planche introuvable")
    if _is_assigned(planche_id, db):
        raise HTTPException(
            status_code=409,
            detail="Cette planche est assignée à une épreuve et ne peut pas être supprimée.",
        )
    db.delete(p)
    db.commit()


@router.get("/{planche_id}/download")
def download_planche(planche_id: int, db: Session = Depends(get_db)):
    """Télécharge le PDF original de la planche depuis la base."""
    p = db.get(Planche, planche_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planche introuvable")
    data = _get_pdf_bytes(p)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{p.nom}.pdf"'},
    )


# ── Assignation planche → épreuve ────────────────────────────────────────────

@router.post("/epreuves/{epreuve_id}/assigner", response_model=dict)
def assigner_planche(epreuve_id: int, body: AssignerPlancheIn, db: Session = Depends(get_db)):
    ep = db.get(Epreuve, epreuve_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    p = db.get(Planche, body.planche_id)
    if not p:
        raise HTTPException(status_code=404, detail="Planche introuvable")
    ep.planche_id = body.planche_id
    db.commit()
    return {"epreuve_id": epreuve_id, "planche_id": body.planche_id}


@router.delete("/epreuves/{epreuve_id}/assigner", status_code=204)
def desassigner_planche(epreuve_id: int, db: Session = Depends(get_db)):
    ep = db.get(Epreuve, epreuve_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    ep.planche_id = None
    db.commit()


@router.get("/epreuves/{epreuve_id}/cartouche")
def download_cartouche(epreuve_id: int, db: Session = Depends(get_db)):
    """Télécharge le PDF avec cartouche candidat en overlay."""
    from app.models.candidat import Candidat
    from app.models.demi_journee import DemiJournee
    from app.services.pdf_cartouche import generate_planche_with_cartouche

    ep = db.get(Epreuve, epreuve_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if not ep.planche_id:
        raise HTTPException(status_code=400, detail="Aucune planche assignée à cette épreuve")
    if not ep.candidat_id:
        raise HTTPException(status_code=400, detail="Aucun candidat assigné à cette épreuve")

    planche = db.get(Planche, ep.planche_id)
    candidat = db.get(Candidat, ep.candidat_id)
    dj = db.get(DemiJournee, ep.demi_journee_id)
    if not dj:
        raise HTTPException(status_code=400, detail="Demi-journée introuvable")

    original_bytes = _get_pdf_bytes(planche)

    examinateur_nom = "—"
    exam_id = ep.examinateur_id or planche.examinateur_id
    if exam_id:
        ex = db.get(Examinateur, exam_id)
        if ex:
            examinateur_nom = f"{ex.prenom} {ex.nom}".strip() if ex.prenom else ex.nom

    matiere_label = ep.matiere
    if not matiere_label and planche.matiere_id:
        m = db.get(Matiere, planche.matiere_id)
        if m:
            matiere_label = m.intitule

    heure_prep = None
    if ep.preparation_minutes:
        from datetime import datetime as _dt, timedelta
        prep_dt = _dt.combine(_dt.today(), ep.heure_debut) - timedelta(minutes=ep.preparation_minutes)
        heure_prep = prep_dt.time()

    pdf_bytes = generate_planche_with_cartouche(
        original_pdf_bytes=original_bytes,
        candidat_nom=candidat.nom,
        candidat_prenom=candidat.prenom or "",
        matiere=matiere_label or "—",
        examinateur=examinateur_nom,
        date_epreuve=dj.date,
        heure_preparation=heure_prep,
        heure_passage=ep.heure_debut,
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{planche.nom}_{candidat.nom}.pdf"'},
    )


# ── Impression groupée (ZIP) ──────────────────────────────────────────────────

class BatchCartoucheIn(BaseModel):
    epreuve_ids: List[int]


@router.post("/batch-cartouche")
def batch_cartouche(body: BatchCartoucheIn, db: Session = Depends(get_db)):
    """Génère un ZIP avec les PDFs cartouchés pour une liste d'épreuves."""
    from datetime import datetime as _dt, timedelta
    from app.models.candidat import Candidat
    from app.models.demi_journee import DemiJournee
    from app.services.pdf_cartouche import generate_planche_with_cartouche

    if not body.epreuve_ids:
        raise HTTPException(status_code=400, detail="Aucune épreuve sélectionnée")

    zip_buf = io.BytesIO()
    errors: List[str] = []
    count = 0

    with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for epreuve_id in body.epreuve_ids:
            ep = db.get(Epreuve, epreuve_id)
            if not ep or not ep.planche_id or not ep.candidat_id:
                errors.append(f"Épreuve {epreuve_id}: planche ou candidat manquant, ignorée")
                continue

            planche = db.get(Planche, ep.planche_id)
            candidat = db.get(Candidat, ep.candidat_id)
            dj = db.get(DemiJournee, ep.demi_journee_id)

            if not planche or not candidat or not dj:
                errors.append(f"Épreuve {epreuve_id}: données incomplètes, ignorée")
                continue

            if not planche.fichier_data:
                errors.append(f"Épreuve {epreuve_id}: fichier PDF non disponible, ignorée")
                continue

            examinateur_nom = "—"
            exam_id = ep.examinateur_id or planche.examinateur_id
            if exam_id:
                ex = db.get(Examinateur, exam_id)
                if ex:
                    examinateur_nom = f"{ex.prenom} {ex.nom}".strip() if ex.prenom else ex.nom

            matiere_label = ep.matiere
            if not matiere_label and planche.matiere_id:
                m = db.get(Matiere, planche.matiere_id)
                if m:
                    matiere_label = m.intitule

            heure_prep = None
            if ep.preparation_minutes:
                prep_dt = _dt.combine(_dt.today(), ep.heure_debut) - timedelta(minutes=ep.preparation_minutes)
                heure_prep = prep_dt.time()

            try:
                pdf_bytes = generate_planche_with_cartouche(
                    original_pdf_bytes=planche.fichier_data,
                    candidat_nom=candidat.nom,
                    candidat_prenom=candidat.prenom or "",
                    matiere=matiere_label or "—",
                    examinateur=examinateur_nom,
                    date_epreuve=dj.date,
                    heure_preparation=heure_prep,
                    heure_passage=ep.heure_debut,
                )
                safe_nom = candidat.nom.replace(" ", "_")
                safe_prenom = (candidat.prenom or "").replace(" ", "_")
                heure_str = str(ep.heure_debut)[:5].replace(":", "-")
                filename = f"{heure_str}_{safe_nom}_{safe_prenom}_{matiere_label or 'matiere'}.pdf"
                zf.writestr(filename, pdf_bytes)
                count += 1
            except Exception as e:
                errors.append(f"Épreuve {epreuve_id}: erreur de génération — {e}")

    if count == 0:
        raise HTTPException(status_code=400, detail="Aucun PDF généré. " + " | ".join(errors))

    zip_buf.seek(0)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M")
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="planches_{ts}.zip"'},
    )


# Import tardif (évite la circularité)
from pathlib import Path  # noqa: E402
