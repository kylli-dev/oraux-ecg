from typing import List, Optional

import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.candidat import Candidat
from app.models.epreuve import Epreuve
from app.models.inscription import Inscription, InscriptionEpreuve
from app.models.liste_attente import ListeAttente
from app.models.note import Note
from app.models.planning import Planning
from app.schemas.candidat import (
    CandidatCreate,
    CandidatCreateOut,
    CandidatDetailOut,
    CandidatOut,
    CandidatUpdate,
)

router = APIRouter(
    prefix="/admin/candidats",
    tags=["candidats"],
    dependencies=[Depends(require_admin)],
)


# ── CRUD candidats ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[CandidatOut])
def list_candidats(planning_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Candidat)
    if planning_id:
        q = q.filter_by(planning_id=planning_id)
    return q.order_by(Candidat.nom, Candidat.prenom).all()


def _infos_etablissement(code_uai: str, db: Session) -> dict:
    """Nom, ville et département de l'établissement, recopiés depuis le référentiel."""
    from app.models.etablissement import Etablissement
    etab = db.query(Etablissement).filter_by(code_uai=code_uai).first()
    if not etab:
        raise HTTPException(status_code=422, detail=f"Établissement {code_uai} introuvable dans le référentiel")
    return dict(etablissement=etab.nom, ville_etablissement=etab.ville, departement_etablissement=etab.departement)


@router.post("/", response_model=CandidatCreateOut, status_code=201)
def create_candidat(body: CandidatCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Ajout manuel d'un candidat. Comme l'import Excel : login = email et mot de passe
    provisoire (renvoyé une seule fois), pour que le candidat puisse se connecter au portail.
    L'établissement est recopié depuis le référentiel (code UAI). Les identifiants ne sont
    envoyés par email (Message-type ADMISSIBILITE) que si l'admin le demande.
    """
    from app.core.auth import hash_password
    from app.services.email import SITE_URL, build_from_template, email_configure, send_email

    if not db.get(Planning, body.planning_id):
        raise HTTPException(status_code=404, detail="Planning introuvable")
    if db.query(Candidat).filter(Candidat.planning_id == body.planning_id, func.lower(Candidat.email) == body.email).first():
        raise HTTPException(status_code=409, detail=f"Un candidat avec l'adresse {body.email} existe déjà dans ce planning")
    if db.query(Candidat).filter(func.lower(Candidat.login) == body.email).first():
        raise HTTPException(
            status_code=409,
            detail=f"L'identifiant {body.email} est déjà utilisé par un candidat d'un autre planning",
        )
    if body.envoyer_identifiants and not email_configure():
        raise HTTPException(
            status_code=503,
            detail="L'envoi d'emails n'est pas configuré sur le serveur : décochez « Envoyer les identifiants par e-mail »",
        )
    data = body.model_dump(exclude={"envoyer_identifiants"})
    if body.code_uai:
        data.update(_infos_etablissement(body.code_uai, db))
    if not data.get("classe"):
        data["classe"] = f"ECG - Maths approfondies et {body.profil}"

    mot_de_passe = secrets.token_urlsafe(8)
    c = Candidat(**data, login=body.email, password_hash=hash_password(mot_de_passe))
    db.add(c)
    db.commit()
    db.refresh(c)

    envoye = False
    if body.envoyer_identifiants:
        message = build_from_template(db, "ADMISSIBILITE", {
            "prenom": c.prenom, "nom": c.nom, "login": c.login, "password": mot_de_passe,
            "url": f"{SITE_URL.rstrip('/')}/candidat",
        })
        if message:
            background_tasks.add_task(send_email, c.email, *message)
            envoye = True
    return CandidatCreateOut(
        **CandidatOut.model_validate(c).model_dump(),
        login=c.login, password_provisoire=mot_de_passe, email_identifiants_envoye=envoye,
    )


@router.get("/{candidat_id}", response_model=CandidatDetailOut)
def get_candidat(candidat_id: int, db: Session = Depends(get_db)):
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")
    return c


@router.put("/{candidat_id}", response_model=CandidatDetailOut)
def update_candidat(candidat_id: int, body: CandidatUpdate, db: Session = Depends(get_db)):
    """
    Modifie la fiche d'un candidat (onglet Candidats → Liste). Mêmes contrôles qu'à l'ajout.
    Si l'email change et servait d'identifiant, le login suit. L'établissement n'est
    recalculé que s'il change : un établissement importé absent du référentiel est conservé.
    """
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")

    ancien_email = (c.email or "").strip().lower()
    if body.email != ancien_email:
        doublon = db.query(Candidat).filter(
            Candidat.planning_id == c.planning_id, Candidat.id != c.id, func.lower(Candidat.email) == body.email,
        ).first()
        if doublon:
            raise HTTPException(status_code=409, detail=f"Un candidat avec l'adresse {body.email} existe déjà dans ce planning")
    login_suit = not c.login or c.login.strip().lower() == ancien_email
    if login_suit and body.email != (c.login or "").strip().lower():
        if db.query(Candidat).filter(Candidat.id != c.id, func.lower(Candidat.login) == body.email).first():
            raise HTTPException(status_code=409, detail=f"L'identifiant {body.email} est déjà utilisé par un autre candidat")

    data = body.model_dump()
    if (body.code_uai or None) != (c.code_uai or None):
        data.update(_infos_etablissement(body.code_uai, db) if body.code_uai
                    else dict(etablissement=None, ville_etablissement=None, departement_etablissement=None))
    if not data.get("classe"):
        data["classe"] = f"ECG - Maths approfondies et {body.profil}"
    for field, value in data.items():
        setattr(c, field, value)
    if login_suit:
        c.login = body.email
    db.commit()
    db.refresh(c)
    return c


@router.delete("/planning/{planning_id}/all", status_code=200)
def delete_all_candidats(planning_id: int, db: Session = Depends(get_db)):
    """Supprime tous les candidats d'un planning (désassigne les épreuves d'abord)."""
    candidats = db.query(Candidat).filter_by(planning_id=planning_id).all()
    count = len(candidats)
    candidat_ids = [c.id for c in candidats]
    if candidat_ids:
        db.query(Epreuve).filter(Epreuve.candidat_id.in_(candidat_ids)).update(
            {"candidat_id": None, "statut": "LIBRE"}, synchronize_session="fetch"
        )
        insc_ids = [i.id for i in db.query(Inscription.id).filter(Inscription.candidat_id.in_(candidat_ids)).all()]
        if insc_ids:
            db.query(InscriptionEpreuve).filter(InscriptionEpreuve.inscription_id.in_(insc_ids)).delete(synchronize_session="fetch")
        db.query(Inscription).filter(Inscription.candidat_id.in_(candidat_ids)).delete(synchronize_session="fetch")
        db.query(ListeAttente).filter(ListeAttente.candidat_id.in_(candidat_ids)).delete(synchronize_session="fetch")
        db.query(Note).filter(Note.candidat_id.in_(candidat_ids)).delete(synchronize_session="fetch")
        db.query(Candidat).filter_by(planning_id=planning_id).delete(synchronize_session="fetch")
    db.commit()
    return {"deleted": count}


@router.delete("/{candidat_id}", status_code=204)
def delete_candidat(candidat_id: int, db: Session = Depends(get_db)):
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")
    # Désassigner les épreuves liées
    db.query(Epreuve).filter_by(candidat_id=candidat_id).update(
        {"candidat_id": None, "statut": "LIBRE"}
    )
    # Supprimer les enregistrements liés (cascade ORM manuelle)
    insc_ids = [i.id for i in db.query(Inscription).filter_by(candidat_id=candidat_id).all()]
    if insc_ids:
        db.query(InscriptionEpreuve).filter(InscriptionEpreuve.inscription_id.in_(insc_ids)).delete(synchronize_session="fetch")
    db.query(Inscription).filter_by(candidat_id=candidat_id).delete()
    db.query(ListeAttente).filter_by(candidat_id=candidat_id).delete()
    db.query(Note).filter_by(candidat_id=candidat_id).delete()
    db.delete(c)
    db.commit()


