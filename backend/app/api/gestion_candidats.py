"""
Interface de gestion des candidats pour le service des admissions.
Permet de visualiser la fiche, l'inscription et la liste d'attente d'un candidat,
et d'assigner / désinscrire / préréserver des triplets de créneaux.
"""
from collections import defaultdict
from datetime import date as Date, datetime, timezone, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.candidat import Candidat
from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.planning import Planning
from app.models.inscription import Inscription, InscriptionEpreuve
from app.models.liste_attente import ListeAttente

router = APIRouter(
    prefix="/admin/gestion-candidats",
    tags=["gestion-candidats"],
    dependencies=[Depends(require_admin)],
)


# ── Schemas ────────────────────────────────────────────────────────────────────

class CandidatListeItem(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    code_candidat: Optional[str] = None
    civilite: Optional[str] = None
    is_inscrit: bool
    inscription_id: Optional[int] = None
    is_liste_attente: bool
    statut: str


class TripletEpreuveOut(BaseModel):
    id: int
    matiere: str
    heure_debut: str
    heure_fin: str


class TripletOut(BaseModel):
    date: Date
    heure_debut: str        # "HH:MM"
    epreuves: List[TripletEpreuveOut]
    type_slot: str          # "LIBRE" | "PRERESERVEE"


class InscriptionOut(BaseModel):
    id: int
    date: Date
    epreuves: List[TripletEpreuveOut]


class ListeAttenteDate(BaseModel):
    date: Date


class FicheOut(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    civilite: Optional[str] = None
    code_candidat: Optional[str] = None
    numero_ine: Optional[str] = None
    profil: Optional[str] = None
    tel_portable: Optional[str] = None
    handicape: Optional[bool] = None
    classe: Optional[str] = None
    etablissement: Optional[str] = None
    ville_etablissement: Optional[str] = None
    qualite: Optional[str] = None
    inscription: Optional[InscriptionOut] = None
    liste_attente: List[ListeAttenteDate] = []


class InscrireIn(BaseModel):
    date: Date
    heure_debut: str        # "HH:MM"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_time(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def _get_active_inscription(candidat_id: int, db: Session) -> Optional[Inscription]:
    return db.query(Inscription).filter_by(candidat_id=candidat_id, statut="ACTIVE").first()


def _cancel_inscription(insc: Inscription, new_statut: str, db: Session) -> None:
    for ie in insc.epreuves:
        ie.epreuve.candidat_id = None
        ie.epreuve.statut = new_statut
    insc.statut = "ANNULEE"
    insc.cancelled_at = _now()


def _build_inscription_out(insc: Inscription, db: Session) -> InscriptionOut:
    epreuves_out = []
    date_val = None
    for ie in insc.epreuves:
        e = ie.epreuve
        dj = db.get(DemiJournee, e.demi_journee_id)
        if date_val is None:
            date_val = dj.date
        epreuves_out.append(TripletEpreuveOut(
            id=e.id,
            matiere=e.matiere,
            heure_debut=str(e.heure_debut)[:5],
            heure_fin=str(e.heure_fin)[:5],
        ))
    epreuves_out.sort(key=lambda x: x.heure_debut)
    return InscriptionOut(id=insc.id, date=date_val, epreuves=epreuves_out)


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/{planning_id}/candidats", response_model=List[CandidatListeItem])
def list_candidats_gestion(planning_id: int, db: Session = Depends(get_db)):
    """Liste tous les candidats d'un planning avec leur statut d'inscription."""
    candidats = (
        db.query(Candidat)
        .filter_by(planning_id=planning_id)
        .order_by(Candidat.nom, Candidat.prenom)
        .all()
    )
    result = []
    for c in candidats:
        insc = db.query(Inscription).filter_by(candidat_id=c.id, statut="ACTIVE").first()
        la = db.query(ListeAttente).filter_by(candidat_id=c.id).first()
        result.append(CandidatListeItem(
            id=c.id,
            nom=c.nom,
            prenom=c.prenom,
            email=c.email,
            code_candidat=c.code_candidat,
            civilite=c.civilite,
            is_inscrit=insc is not None,
            inscription_id=insc.id if insc else None,
            is_liste_attente=la is not None,
            statut=c.statut,
        ))
    return result


@router.get("/candidat/{candidat_id}/fiche", response_model=FicheOut)
def get_fiche(candidat_id: int, db: Session = Depends(get_db)):
    """Retourne la fiche complète d'un candidat (profil + inscription + liste d'attente)."""
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")

    insc = _get_active_inscription(candidat_id, db)
    la_dates = [
        ListeAttenteDate(date=la.date)
        for la in db.query(ListeAttente).filter_by(candidat_id=candidat_id).order_by(ListeAttente.date).all()
    ]

    return FicheOut(
        id=c.id,
        nom=c.nom,
        prenom=c.prenom,
        email=c.email,
        civilite=c.civilite,
        code_candidat=c.code_candidat,
        numero_ine=c.numero_ine,
        profil=c.profil,
        tel_portable=c.tel_portable,
        handicape=c.handicape,
        classe=c.classe,
        etablissement=c.etablissement,
        ville_etablissement=c.ville_etablissement,
        qualite=c.qualite,
        inscription=_build_inscription_out(insc, db) if insc else None,
        liste_attente=la_dates,
    )


@router.get("/{planning_id}/triplets", response_model=List[TripletOut])
def get_triplets_admin(planning_id: int, db: Session = Depends(get_db)):
    """
    Retourne tous les triplets disponibles (admin : sans cutoff de date).
    Inclut les créneaux LIBRE et PRERESERVEE.
    """
    djs = (
        db.query(DemiJournee)
        .filter_by(planning_id=planning_id)
        .order_by(DemiJournee.date, DemiJournee.heure_debut)
        .all()
    )

    djs_by_date: dict = defaultdict(list)
    for dj in djs:
        djs_by_date[dj.date].append(dj)

    result = []
    for date in sorted(djs_by_date.keys()):
        djs_of_day = djs_by_date[date]
        dj_ids = [dj.id for dj in djs_of_day]

        all_epreuves = (
            db.query(Epreuve)
            .filter(Epreuve.demi_journee_id.in_(dj_ids))
            .order_by(Epreuve.heure_debut, Epreuve.matiere)
            .all()
        )
        if not all_epreuves:
            continue

        all_slots = sorted(set(e.heure_debut for e in all_epreuves))
        matieres_sorted = sorted(set(e.matiere for e in all_epreuves))
        N_rooms = len(matieres_sorted)
        total_slots = len(all_slots)
        offset = total_slots // N_rooms if N_rooms else 1

        disponibles = {
            (e.matiere, e.heure_debut): e
            for e in all_epreuves
            if e.statut in ("LIBRE", "PRERESERVEE")
        }

        for k in range(total_slots):
            assigned = []
            valid = True
            for i, matiere in enumerate(matieres_sorted):
                slot_idx = (k + i * offset) % total_slots
                epreuve = disponibles.get((matiere, all_slots[slot_idx]))
                if epreuve is None:
                    valid = False
                    break
                assigned.append(epreuve)

            if not valid or not assigned:
                continue

            type_slot = "PRERESERVEE" if any(e.statut == "PRERESERVEE" for e in assigned) else "LIBRE"
            epreuves_out = sorted([
                TripletEpreuveOut(
                    id=e.id,
                    matiere=e.matiere,
                    heure_debut=str(e.heure_debut)[:5],
                    heure_fin=str(e.heure_fin)[:5],
                )
                for e in assigned
            ], key=lambda x: x.heure_debut)

            result.append(TripletOut(
                date=date,
                heure_debut=str(all_slots[k])[:5],
                epreuves=epreuves_out,
                type_slot=type_slot,
            ))

    return result


@router.post("/candidat/{candidat_id}/inscrire")
def admin_inscrire(
    candidat_id: int,
    body: InscrireIn,
    db: Session = Depends(get_db),
):
    """
    Inscrit un candidat à un triplet (admin, sans restriction de date ni statut planning).
    Si déjà inscrit : swap atomique (annule l'ancienne inscription → LIBRE, crée la nouvelle).
    """
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")

    djs = (
        db.query(DemiJournee)
        .filter_by(planning_id=c.planning_id)
        .filter(DemiJournee.date == body.date)
        .all()
    )
    dj_ids = [dj.id for dj in djs]
    if not dj_ids:
        raise HTTPException(status_code=404, detail="Aucune épreuve pour cette date")

    all_epreuves_day = (
        db.query(Epreuve)
        .filter(Epreuve.demi_journee_id.in_(dj_ids))
        .order_by(Epreuve.heure_debut, Epreuve.matiere)
        .all()
    )

    all_slots = sorted(set(e.heure_debut for e in all_epreuves_day))
    matieres_sorted = sorted(set(e.matiere for e in all_epreuves_day))
    N_rooms = len(matieres_sorted)
    total_slots = len(all_slots)
    offset = total_slots // N_rooms if N_rooms else 1

    heure_debut_t = _parse_time(body.heure_debut)
    if heure_debut_t not in all_slots:
        raise HTTPException(status_code=400, detail="Créneau de départ invalide")
    k = all_slots.index(heure_debut_t)

    disponibles_map = {
        (e.matiere, e.heure_debut): e
        for e in all_epreuves_day
        if e.statut in ("LIBRE", "PRERESERVEE")
    }

    epreuves_a_attribuer = []
    for i, matiere in enumerate(matieres_sorted):
        slot_idx = (k + i * offset) % total_slots
        target_heure = all_slots[slot_idx]
        epreuve = disponibles_map.get((matiere, target_heure))
        if epreuve is None:
            raise HTTPException(
                status_code=409,
                detail=f"Créneau indisponible pour {matiere} à {str(target_heure)[:5]}",
            )
        epreuves_a_attribuer.append(epreuve)

    # Annuler l'inscription précédente si existante
    ancienne = _get_active_inscription(candidat_id, db)
    if ancienne:
        _cancel_inscription(ancienne, "LIBRE", db)
        # TODO: envoyer Message-type Désinscription

    nouvelle = Inscription(candidat_id=candidat_id, statut="ACTIVE")
    db.add(nouvelle)
    db.flush()

    for e in epreuves_a_attribuer:
        e.candidat_id = candidat_id
        e.statut = "ATTRIBUEE"
        db.add(InscriptionEpreuve(inscription_id=nouvelle.id, epreuve_id=e.id))

    db.commit()
    # TODO: envoyer Message-type Convocation
    return {"candidat_id": candidat_id, "inscription_id": nouvelle.id, "statut": "ACTIVE"}


@router.post("/candidat/{candidat_id}/desinscrire")
def admin_desinscrire(candidat_id: int, db: Session = Depends(get_db)):
    """Désinscrit un candidat → épreuves LIBRE. Envoie Message-type Désinscription."""
    insc = _get_active_inscription(candidat_id, db)
    if not insc:
        raise HTTPException(status_code=404, detail="Aucune inscription active")
    _cancel_inscription(insc, "LIBRE", db)
    db.commit()
    # TODO: envoyer Message-type Désinscription
    return {"candidat_id": candidat_id, "statut": "ANNULEE", "epreuves_statut": "LIBRE"}


@router.post("/candidat/{candidat_id}/desinscrire-prereserver")
def admin_desinscrire_prereserver(candidat_id: int, db: Session = Depends(get_db)):
    """Désinscrit un candidat et préréserve les créneaux → épreuves PRERESERVEE."""
    insc = _get_active_inscription(candidat_id, db)
    if not insc:
        raise HTTPException(status_code=404, detail="Aucune inscription active")
    _cancel_inscription(insc, "PRERESERVEE", db)
    db.commit()
    # TODO: envoyer Message-type Désinscription
    return {"candidat_id": candidat_id, "statut": "ANNULEE", "epreuves_statut": "PRERESERVEE"}


@router.post("/candidat/{candidat_id}/casser-triplet")
def admin_casser_triplet(candidat_id: int, db: Session = Depends(get_db)):
    """
    Casse le triplet : dissolution de l'inscription, chaque épreuve retourne à LIBRE
    pour permettre une affectation individuelle.
    """
    insc = _get_active_inscription(candidat_id, db)
    if not insc:
        raise HTTPException(status_code=404, detail="Aucune inscription active")
    _cancel_inscription(insc, "LIBRE", db)
    db.commit()
    return {"candidat_id": candidat_id, "statut": "ANNULEE", "epreuves_statut": "LIBRE"}
