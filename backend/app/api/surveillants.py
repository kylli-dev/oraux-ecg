import io
import re
import secrets
from typing import List, Optional

import openpyxl
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.core.auth import hash_password
from app.db.deps import get_db
from app.models.surveillant import Surveillant
from app.models.surveillant_planning import SurveillantPlanning
from app.schemas.surveillant import (
    SurveillantCreate,
    SurveillantCreatedOut,
    SurveillantOut,
    SurveillantUpdate,
)
from app.services.email import send_credentials_surveillant

router = APIRouter(
    prefix="/admin/surveillants",
    tags=["surveillants"],
    dependencies=[Depends(require_admin)],
)


def _gen_password() -> str:
    return secrets.token_urlsafe(10)


# ── Import Excel ──────────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.get("/import/template")
def template_import():
    """Modèle Excel : nom, prénom, email (une ligne par surveillant)."""
    from app.services.excel import _autosize, _header_row
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Surveillants"
    _header_row(ws, ["nom", "prenom", "email"])
    ws.append(["MARTIN", "Sophie", "sophie.martin@ensae.fr"])
    ws.append(["DUBOIS", "Marc", "marc.dubois@ensae.fr"])
    _autosize(ws)
    buf = io.BytesIO()
    wb.save(buf)
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_surveillants.xlsx"},
    )


@router.post("/import")
def import_surveillants(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    planning_id: Optional[int] = None,
    envoyer_identifiants: bool = True,
    db: Session = Depends(get_db),
):
    """
    Crée des surveillants depuis un Excel (colonnes A: nom, B: prénom, C: email).
    Une adresse déjà connue n'est pas recréée (elle est seulement associée au planning).
    Chaque nouveau surveillant reçoit ses identifiants par email, envoyés en arrière-plan.
    """
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Fichier Excel (.xlsx) requis")
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file.file.read()), data_only=True, read_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Fichier Excel illisible")
    ws = wb.active

    existants = {
        e.lower(): sid for sid, e in db.query(Surveillant.id, Surveillant.email).all() if e
    }
    crees: list[dict] = []
    deja: list[dict] = []
    erreurs: list[str] = []
    a_envoyer: list[tuple[str, str, str, str]] = []
    vus: set[str] = set()

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        row = tuple(row or ())
        if not any(c not in (None, "") for c in row):
            continue
        nom = str(row[0]).strip() if len(row) > 0 and row[0] is not None else ""
        prenom = str(row[1]).strip() if len(row) > 1 and row[1] is not None else ""
        email = str(row[2]).strip() if len(row) > 2 and row[2] is not None else ""
        if not (nom and prenom and email):
            erreurs.append(f"Ligne {i} : nom, prénom et email obligatoires")
            continue
        if not _EMAIL_RE.match(email):
            erreurs.append(f"Ligne {i} : adresse email invalide ({email})")
            continue
        cle = email.lower()
        if cle in vus:
            erreurs.append(f"Ligne {i} : {email} figure déjà plus haut dans le fichier")
            continue
        vus.add(cle)

        if cle in existants:
            sid = existants[cle]
            deja.append({"id": sid, "nom": nom.upper(), "prenom": prenom, "email": email})
        else:
            plain = _gen_password()
            s = Surveillant(nom=nom.upper(), prenom=prenom, email=email, actif=True,
                            password_hash=hash_password(plain, rounds=4))
            db.add(s)
            db.flush()
            sid = s.id
            crees.append({"id": s.id, "nom": s.nom, "prenom": s.prenom, "email": s.email})
            a_envoyer.append((s.email, s.prenom, s.nom, plain))

        if planning_id:
            lien = db.query(SurveillantPlanning).filter_by(surveillant_id=sid, planning_id=planning_id).first()
            if lien:
                lien.actif = True
            else:
                db.add(SurveillantPlanning(surveillant_id=sid, planning_id=planning_id, actif=True))
    db.commit()

    if envoyer_identifiants:
        for to, prenom, nom, plain in a_envoyer:
            background_tasks.add_task(_envoyer_identifiants_import, to, prenom, nom, plain)

    return {
        "created": len(crees),
        "surveillants": crees,
        "deja_presents": deja,
        "errors": erreurs,
        "emails_programmes": len(a_envoyer) if envoyer_identifiants else 0,
    }


def _envoyer_identifiants_import(to: str, prenom: str, nom: str, plain: str) -> None:
    """Tâche de fond : sa propre session (celle de la requête est fermée à ce stade)."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        send_credentials_surveillant(to_email=to, prenom=prenom, nom=nom, login=to, plain_password=plain, db=db)
    except Exception as e:  # un échec d'envoi ne doit pas interrompre les suivants
        print(f"[import surveillants] email non envoyé à {to} : {e}")
    finally:
        db.close()


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SurveillantOut])
def list_surveillants(planning_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Retourne tous les surveillants du pool global.
    Si planning_id est fourni, enrichit chaque surveillant avec son statut
    actif_planning pour ce planning (None = non associé).
    """
    surveillants = db.query(Surveillant).order_by(Surveillant.nom, Surveillant.prenom).all()
    if not planning_id:
        return surveillants
    liens = {
        sp.surveillant_id: sp.actif
        for sp in db.query(SurveillantPlanning).filter_by(planning_id=planning_id).all()
    }
    result = []
    for s in surveillants:
        out = SurveillantOut.model_validate(s)
        out.actif_planning = liens.get(s.id)  # None si non associé
        result.append(out)
    return result


@router.post("/", response_model=SurveillantCreatedOut, status_code=201)
def create_surveillant(body: SurveillantCreate, db: Session = Depends(get_db)):
    """
    Crée un surveillant dans le pool global (sans planning).
    Génère ses identifiants et envoie la notification email si SMTP configuré.
    Retourne le mot de passe en clair pour affichage admin.
    """
    plain_pwd = _gen_password()
    s = Surveillant(
        nom=body.nom.strip().upper(),
        prenom=body.prenom.strip(),
        email=body.email.strip(),
        actif=body.actif,
        password_hash=hash_password(plain_pwd, rounds=4),
    )
    db.add(s)
    db.commit()
    db.refresh(s)

    email_sent = send_credentials_surveillant(
        to_email=s.email,
        prenom=s.prenom,
        nom=s.nom,
        login=s.email,
        plain_password=plain_pwd,
        db=db,
    )

    return SurveillantCreatedOut(
        id=s.id,
        nom=s.nom,
        prenom=s.prenom,
        email=s.email,
        actif=s.actif,
        code_acces=s.code_acces,
        plain_password=plain_pwd,
        email_sent=email_sent,
    )


@router.get("/{surveillant_id}", response_model=SurveillantOut)
def get_surveillant(surveillant_id: int, db: Session = Depends(get_db)):
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    return s


@router.put("/{surveillant_id}", response_model=SurveillantOut)
def update_surveillant(surveillant_id: int, body: SurveillantUpdate, db: Session = Depends(get_db)):
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    data = body.model_dump(exclude_none=True)
    if "nom" in data:
        data["nom"] = data["nom"].strip().upper()
    if "prenom" in data:
        data["prenom"] = data["prenom"].strip()
    if "email" in data:
        data["email"] = data["email"].strip()
    for field, value in data.items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.patch("/{surveillant_id}/plannings/{planning_id}", response_model=SurveillantOut)
def set_actif_planning(surveillant_id: int, planning_id: int, body: dict, db: Session = Depends(get_db)):
    """Crée ou met à jour l'association surveillant ↔ planning avec le flag actif."""
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    actif = bool(body.get("actif", True))
    lien = db.query(SurveillantPlanning).filter_by(
        surveillant_id=surveillant_id, planning_id=planning_id
    ).first()
    if lien:
        lien.actif = actif
    else:
        lien = SurveillantPlanning(surveillant_id=surveillant_id, planning_id=planning_id, actif=actif)
        db.add(lien)
    db.commit()
    db.refresh(s)
    out = SurveillantOut.model_validate(s)
    out.actif_planning = actif
    return out


@router.patch("/{surveillant_id}/actif", response_model=SurveillantOut)
def toggle_actif(surveillant_id: int, body: dict, db: Session = Depends(get_db)):
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    s.actif = bool(body.get("actif", True))
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{surveillant_id}", status_code=204)
def delete_surveillant(surveillant_id: int, db: Session = Depends(get_db)):
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")
    db.delete(s)
    db.commit()


# ── Renvoi des identifiants ────────────────────────────────────────────────────

@router.post("/{surveillant_id}/envoyer-identifiants", response_model=SurveillantCreatedOut)
def envoyer_identifiants(surveillant_id: int, db: Session = Depends(get_db)):
    """Génère un nouveau mot de passe et envoie la notification."""
    s = db.get(Surveillant, surveillant_id)
    if not s:
        raise HTTPException(status_code=404, detail="Surveillant introuvable")

    plain_pwd = _gen_password()
    s.password_hash = hash_password(plain_pwd, rounds=4)
    db.commit()
    db.refresh(s)

    email_sent = send_credentials_surveillant(
        to_email=s.email,
        prenom=s.prenom,
        nom=s.nom,
        login=s.email,
        plain_password=plain_pwd,
        db=db,
    )

    return SurveillantCreatedOut(
        id=s.id,
        nom=s.nom,
        prenom=s.prenom,
        email=s.email,
        actif=s.actif,
        code_acces=s.code_acces,
        plain_password=plain_pwd,
        email_sent=email_sent,
    )
