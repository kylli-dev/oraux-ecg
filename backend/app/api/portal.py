"""
Portail candidat (routes publiques ou protégées par JWT candidat — pas de clé admin).
"""
from datetime import date as Date, datetime, timezone, time, timedelta


def _now_utc() -> datetime:
    """Retourne l'heure UTC courante en datetime naïf (compatible SQLite)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _ensure_naive(dt: datetime) -> datetime:
    """S'assure qu'un datetime est naïf (supprime tzinfo si présent)."""
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.models.candidat import Candidat
from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.planning import Planning
from app.models.inscription import Inscription, InscriptionEpreuve
from app.models.liste_attente import ListeAttente
from app.models.note import Note
from app.core.auth import (
    verify_password,
    hash_password,
    create_access_token,
    generate_reset_token,
    reset_token_expiry,
)
from app.core.portal_guard import require_candidat

router = APIRouter(prefix="/portal", tags=["portal"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    login: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordIn(BaseModel):
    login: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class CandidatMeOut(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    profil: Optional[str]
    login: Optional[str]

    class Config:
        from_attributes = True


class PortalEpreuveOut(BaseModel):
    id: int
    date: Date
    type_dj: str
    heure_debut: str
    heure_fin: str
    matiere: str
    statut: str
    est_le_mien: bool

    class Config:
        from_attributes = True


class PortalPlanningOut(BaseModel):
    planning_id: int
    planning_nom: str
    candidat_id: int
    candidat_nom: str
    candidat_prenom: str
    epreuves: List[PortalEpreuveOut]


class InscriptionIn(BaseModel):
    epreuve_id: int


class TripletInscrireIn(BaseModel):
    date: Date
    heure_debut: time  # nouveau


class NoteOut(BaseModel):
    matiere: str
    valeur: Optional[float]
    published_at: Optional[datetime]

    class Config:
        from_attributes = True


class ListeAttenteIn(BaseModel):
    dates: List[Date]  # Liste des journées cochées (remplace l'existant)


class JourneeDisponibleOut(BaseModel):
    date: Date
    nb_epreuves: int  # Nb d'épreuves prévues ce jour (indicatif)


class ListeAttenteOut(BaseModel):
    dates_cochees: List[Date]
    journees_disponibles: List[JourneeDisponibleOut]


class TripletEpreuveOut(BaseModel):
    id: int
    matiere: str
    heure_debut: str       # heure début examen
    heure_fin: str         # heure fin examen
    heure_prepa: Optional[str] = None  # heure début préparation (si prep > 0)
    demi_journee_type: str  # MATIN / APRES_MIDI
    salle_intitule: Optional[str] = None
    salle_preparation_intitule: Optional[str] = None

    class Config:
        from_attributes = True


class TripletOut(BaseModel):
    date: Date
    heure_debut: time  # nouveau
    heure_fin: time    # nouveau
    nb_epreuves: int
    epreuves: List[TripletEpreuveOut]


class InscriptionActiveOut(BaseModel):
    id: int
    date: Date
    statut: str
    epreuves: List[TripletEpreuveOut]


# ── Auth ───────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Authentification candidat par login ou email / mot de passe."""
    identifier = body.login.strip()
    c = (
        db.query(Candidat).filter_by(login=identifier).first()
        or db.query(Candidat).filter_by(email=identifier).first()
    )
    if not c or not c.password_hash or not verify_password(body.password, c.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    return TokenOut(access_token=create_access_token(c.id))


@router.get("/me", response_model=CandidatMeOut)
def get_me(candidat_id: int = Depends(require_candidat), db: Session = Depends(get_db)):
    """Retourne le profil du candidat connecté."""
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat introuvable")
    return c


@router.post("/me/change-password", status_code=204)
def change_password(
    body: ChangePasswordIn,
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """Le candidat change son mot de passe (doit fournir l'ancien)."""
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat introuvable")
    planning = db.get(Planning, c.planning_id)
    if planning and planning.interdire_modification_candidat:
        raise HTTPException(status_code=403, detail="La modification du profil est interdite pour ce planning.")
    if not c.password_hash or not verify_password(body.current_password, c.password_hash):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins 8 caractères")
    c.password_hash = hash_password(body.new_password)
    db.commit()


@router.post("/forgot-password", status_code=204)
def forgot_password(body: ForgotPasswordIn, db: Session = Depends(get_db)):
    """
    Génère un token de réinitialisation.
    En production, envoyer le token par email (Message-type Réinitialisation).
    Retourne 204 même si le login est inconnu (pas d'énumération d'utilisateurs).
    """
    c = db.query(Candidat).filter_by(login=body.login.strip()).first()
    if c:
        c.reset_token = generate_reset_token()
        c.reset_token_expires_at = reset_token_expiry()
        db.commit()
        # TODO: envoyer l'email avec le lien contenant c.reset_token


@router.post("/reset-password", status_code=204)
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)):
    """Réinitialise le mot de passe avec le token reçu par email."""
    c = db.query(Candidat).filter_by(reset_token=body.token).first()
    if not c or not c.reset_token_expires_at:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    if c.reset_token_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins 8 caractères")
    c.password_hash = hash_password(body.new_password)
    c.reset_token = None
    c.reset_token_expires_at = None
    db.commit()


# ── Vue planning (legacy code_acces + nouveau JWT) ─────────────────────────────

@router.get("/planning", response_model=PortalPlanningOut)
def get_portal(
    code: Optional[str] = Query(default=None),
    candidat_id: Optional[int] = Depends(require_candidat) if False else None,
    db: Session = Depends(get_db),
):
    """
    Retourne la vue du candidat identifié par son code d'accès (legacy).
    Utiliser GET /portal/me/planning pour l'auth JWT.
    """
    c = db.query(Candidat).filter_by(code_acces=code.upper()).first() if code else None
    if not c:
        raise HTTPException(status_code=404, detail="Code invalide")
    return _build_planning_out(c, db)


@router.get("/me/planning", response_model=PortalPlanningOut)
def get_my_planning(
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """Retourne le planning du candidat connecté (auth JWT)."""
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat introuvable")
    return _build_planning_out(c, db)


def _build_planning_out(c: Candidat, db: Session) -> PortalPlanningOut:
    planning = db.get(Planning, c.planning_id)
    if not planning:
        raise HTTPException(status_code=404, detail="Planning introuvable")

    djs = (
        db.query(DemiJournee)
        .filter_by(planning_id=c.planning_id)
        .order_by(DemiJournee.date, DemiJournee.heure_debut)
        .all()
    )

    epreuves_out: List[PortalEpreuveOut] = []
    for dj in djs:
        epreuves = (
            db.query(Epreuve)
            .filter(
                Epreuve.demi_journee_id == dj.id,
                Epreuve.statut.in_(["LIBRE", "ATTRIBUEE"]),
            )
            .order_by(Epreuve.heure_debut)
            .all()
        )
        for e in epreuves:
            est_le_mien = e.candidat_id == c.id
            if e.statut == "ATTRIBUEE" and not est_le_mien:
                continue
            epreuves_out.append(
                PortalEpreuveOut(
                    id=e.id,
                    date=dj.date,
                    type_dj=dj.type,
                    heure_debut=str(e.heure_debut)[:5],
                    heure_fin=str(e.heure_fin)[:5],
                    matiere=e.matiere,
                    statut=e.statut,
                    est_le_mien=est_le_mien,
                )
            )

    return PortalPlanningOut(
        planning_id=planning.id,
        planning_nom=planning.nom,
        candidat_id=c.id,
        candidat_nom=c.nom,
        candidat_prenom=c.prenom,
        epreuves=epreuves_out,
    )


# ── Triplets & Inscriptions (JWT) ─────────────────────────────────────────────

def _heure_prepa(heure_debut, prep_min: Optional[int]) -> Optional[str]:
    """Retourne l'heure de début de préparation (HH:MM), ou None si pas de prépa."""
    if not prep_min:
        return None
    from datetime import datetime, timedelta
    dt = datetime.combine(datetime(2000, 1, 1), heure_debut) - timedelta(minutes=prep_min)
    return dt.strftime("%H:%M")


# Matieres exclusives par profil : un candidat HGG ne passe pas ESH, et vice-versa
_PROFIL_EXCLUSION: dict = {"HGG": "ESH", "ESH": "HGG"}


def _profil_effectif(c) -> str:
    """Retourne le profil HGG/ESH du candidat, en se rabattant sur la classe si profil est null."""
    if c.profil:
        return c.profil.strip().upper()
    classe = (c.classe or "").upper()
    if "ESH" in classe:
        return "ESH"
    if "HGG" in classe:
        return "HGG"
    return ""


def _cutoff_date(planning: Planning) -> Date:
    """
    Avant heure_previs : J+1 accessible (cutoff = J+1, soit demain disponible).
    Après heure_previs  : J+1 inaccessible, J+2 minimum (cutoff = J+2).
    """
    now = datetime.now()
    previs = planning.heure_previs or time(16, 0)
    if now.time() >= previs:
        return Date.today() + timedelta(days=2)   # après préavis : J+2 minimum
    return Date.today() + timedelta(days=1)        # avant préavis : J+1 minimum


@router.get("/me/triplets", response_model=List[TripletOut])
def get_triplets(
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """
    Retourne les rotations disponibles à l'inscription (modèle jury rotatif).

    Pour chaque date, calcule les rotations valides : une rotation k est disponible
    si pour chaque salle i (matière), il existe un créneau LIBRE à l'horaire
    all_slots[(k + i × offset) % total_slots].
    """
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat introuvable")

    planning = db.get(Planning, c.planning_id)
    cutoff = _cutoff_date(planning)

    djs = (
        db.query(DemiJournee)
        .filter(
            DemiJournee.planning_id == c.planning_id,
            DemiJournee.date >= cutoff,
        )
        .order_by(DemiJournee.date, DemiJournee.heure_debut)
        .all()
    )

    from collections import defaultdict

    djs_by_date: dict = defaultdict(list)
    for dj in djs:
        djs_by_date[dj.date].append(dj)

    result = []
    for date in sorted(djs_by_date.keys()):
        djs_of_day = djs_by_date[date]

        # Calculer les triplets PAR DEMI-JOURNÉE avec le modèle N² exact.
        # offset = N (nombre de matières), itération par round de N² créneaux.
        for dj in djs_of_day:
            dj_epreuves = (
                db.query(Epreuve)
                .filter(Epreuve.demi_journee_id == dj.id)
                .order_by(Epreuve.heure_debut, Epreuve.matiere)
                .all()
            )
            if not dj_epreuves:
                continue

            # Filtrage par profil candidat (HGG / ESH)
            profil_upper = _profil_effectif(c)
            matiere_exclue = _PROFIL_EXCLUSION.get(profil_upper)
            if matiere_exclue:
                had_exclusion = any(e.matiere.upper() == matiere_exclue for e in dj_epreuves)
                dj_epreuves = [e for e in dj_epreuves if e.matiere.upper() != matiere_exclue]
                # Si la demi-journée contient la matière de l'autre filière mais pas celle du candidat → ignorer
                if had_exclusion and not any(e.matiere.upper() == profil_upper for e in dj_epreuves):
                    continue

            matieres_sorted = sorted(set(e.matiere for e in dj_epreuves))
            N_rooms = len(matieres_sorted)
            if N_rooms == 0:
                continue

            # Index : (matiere, heure_debut) → liste d'épreuves LIBRES
            from collections import defaultdict as _dd
            libres_multi: dict = _dd(list)
            for e in dj_epreuves:
                if e.statut == "LIBRE":
                    libres_multi[(e.matiere, e.heure_debut)].append(e)

            # Créneaux par matière
            matiere_slots = {
                m: sorted(set(e.heure_debut for e in dj_epreuves if e.matiere == m))
                for m in matieres_sorted
            }

            # Détection du modèle : interleaved (même créneaux) vs séquentiel (fenêtres distinctes)
            first_slots = set(matiere_slots[matieres_sorted[0]])
            all_same_times = all(
                set(matiere_slots[m]) == first_slots for m in matieres_sorted[1:]
            )

            triplet_candidates: list = []

            if all_same_times:
                # Modèle N² interleaved : candidat k fait matière i au créneau k + i*N
                all_slots = sorted(first_slots)
                total_slots = len(all_slots)
                n_sq = N_rooms * N_rooms
                offset = N_rooms
                rounds = total_slots // n_sq if n_sq else 0
                for round_idx in range(rounds):
                    base = round_idx * n_sq
                    for k in range(n_sq):
                        candidate: list = []
                        valid = True
                        for i, matiere in enumerate(matieres_sorted):
                            slot_idx = base + k + i * offset
                            if slot_idx >= total_slots:
                                valid = False
                                break
                            ep_list = libres_multi.get((matiere, all_slots[slot_idx]), [])
                            if not ep_list:
                                valid = False
                                break
                            candidate.append((ep_list[0], dj))
                        if valid and candidate:
                            triplet_candidates.append(candidate)
            else:
                # Modèle séquentiel : triplet k = chaque matière à son k-ème créneau
                S = min(len(matiere_slots[m]) for m in matieres_sorted)
                for k in range(S):
                    candidate = []
                    valid = True
                    for matiere in matieres_sorted:
                        slot = matiere_slots[matiere][k]
                        ep_list = libres_multi.get((matiere, slot), [])
                        if not ep_list:
                            valid = False
                            break
                        candidate.append((ep_list[0], dj))
                    if valid and candidate:
                        triplet_candidates.append(candidate)

            seen: set = set()
            for assigned in triplet_candidates:
                # Déduplication par combinaison d'épreuves
                key = frozenset(e.id for e, _ in assigned)
                if key in seen:
                    continue
                seen.add(key)

                heure_debut_first = min(e.heure_debut for e, _ in assigned)
                heure_fin_last = max(e.heure_fin for e, _ in assigned)
                epreuves_out = sorted(
                    [
                        TripletEpreuveOut(
                            id=e.id,
                            matiere=e.matiere,
                            heure_debut=str(e.heure_debut)[:5],
                            heure_fin=str(e.heure_fin)[:5],
                            heure_prepa=_heure_prepa(e.heure_debut, e.preparation_minutes),
                            demi_journee_type=dj.type,
                            salle_intitule=e.salle.intitule if e.salle else None,
                            salle_preparation_intitule=e.salle_preparation.intitule if e.salle_preparation else None,
                        )
                        for e, dj in assigned
                    ],
                    key=lambda x: x.heure_prepa or x.heure_debut,
                )
                result.append(
                    TripletOut(
                        date=date,
                        heure_debut=heure_debut_first,
                        heure_fin=heure_fin_last,
                        nb_epreuves=len(assigned),
                        epreuves=epreuves_out,
                    )
                )

    return result


@router.get("/me/inscription", response_model=Optional[InscriptionActiveOut])
def get_inscription(
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """Retourne l'inscription active du candidat, ou null."""
    insc = (
        db.query(Inscription)
        .filter_by(candidat_id=candidat_id, statut="ACTIVE")
        .first()
    )
    if not insc:
        return None

    epreuves_out = []
    for ie in insc.epreuves:
        e = ie.epreuve
        dj = db.get(DemiJournee, e.demi_journee_id)
        epreuves_out.append(
            TripletEpreuveOut(
                id=e.id,
                matiere=e.matiere,
                heure_debut=str(e.heure_debut)[:5],
                heure_fin=str(e.heure_fin)[:5],
                heure_prepa=_heure_prepa(e.heure_debut, e.preparation_minutes),
                demi_journee_type=dj.type,
                salle_intitule=e.salle.intitule if e.salle else None,
                salle_preparation_intitule=e.salle_preparation.intitule if e.salle_preparation else None,
            )
        )
    epreuves_out.sort(key=lambda x: x.heure_prepa or x.heure_debut)

    # Récupérer la date depuis la première épreuve
    first_dj = db.get(DemiJournee, insc.epreuves[0].epreuve.demi_journee_id)
    return InscriptionActiveOut(
        id=insc.id,
        date=first_dj.date,
        statut=insc.statut,
        epreuves=epreuves_out,
    )


@router.post("/me/inscriptions", response_model=InscriptionActiveOut, status_code=201)
def s_inscrire_triplet(
    body: TripletInscrireIn,
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """
    Inscrit le candidat au triplet du jour choisi.
    Si déjà inscrit : swap atomique (annule l'ancienne, crée la nouvelle).
    """
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat introuvable")

    planning = db.get(Planning, c.planning_id)

    # Vérifier que le planning est ouvert aux inscriptions
    if planning.statut != "OUVERT":
        raise HTTPException(
            status_code=403,
            detail="Les inscriptions ne sont pas ouvertes pour ce planning.",
        )
    now = _now_utc()
    if now < _ensure_naive(planning.date_ouverture_inscriptions):
        raise HTTPException(
            status_code=403,
            detail="Les inscriptions n'ont pas encore débuté.",
        )
    if now > _ensure_naive(planning.date_fermeture_inscriptions):
        raise HTTPException(
            status_code=403,
            detail="La période d'inscription est terminée.",
        )

    cutoff = _cutoff_date(planning)
    if body.date < cutoff:
        raise HTTPException(
            status_code=400,
            detail=f"Les inscriptions pour cette date sont closes (préavis : {planning.heure_previs}).",
        )

    # Vérifier l'interdiction de changement de créneau (si déjà inscrit)
    if planning.interdire_changement_creneau:
        inscription_active = (
            db.query(Inscription)
            .filter_by(candidat_id=candidat_id, statut="ACTIVE")
            .first()
        )
        if inscription_active:
            raise HTTPException(
                status_code=403,
                detail="Le changement de créneau est interdit pour ce planning.",
            )

    # Récupérer toutes les demi-journées du jour pour reconstituer la grille de rotation
    from collections import defaultdict as _dd

    djs = (
        db.query(DemiJournee)
        .filter_by(planning_id=c.planning_id)
        .filter(DemiJournee.date == body.date)
        .order_by(DemiJournee.heure_debut)
        .all()
    )
    if not djs:
        raise HTTPException(status_code=404, detail="Aucune épreuve trouvée pour cette date.")

    # Même algorithme N² que get_triplets : traitement par demi-journée
    epreuves_a_attribuer = None
    djs_ref = []  # demi-journées concernées (pour la réponse)

    for dj in djs:
        dj_epreuves = (
            db.query(Epreuve)
            .filter(Epreuve.demi_journee_id == dj.id)
            .order_by(Epreuve.heure_debut, Epreuve.matiere)
            .all()
        )
        if not dj_epreuves:
            continue

        # Filtrage par profil candidat (HGG / ESH)
        profil_upper = _profil_effectif(c)
        matiere_exclue = _PROFIL_EXCLUSION.get(profil_upper)
        if matiere_exclue:
            had_exclusion = any(e.matiere.upper() == matiere_exclue for e in dj_epreuves)
            dj_epreuves = [e for e in dj_epreuves if e.matiere.upper() != matiere_exclue]
            if had_exclusion and not any(e.matiere.upper() == profil_upper for e in dj_epreuves):
                continue

        matieres_sorted = sorted(set(e.matiere for e in dj_epreuves))
        N_rooms = len(matieres_sorted)
        if N_rooms == 0:
            continue

        libres_multi: dict = _dd(list)
        for e in dj_epreuves:
            if e.statut == "LIBRE":
                libres_multi[(e.matiere, e.heure_debut)].append(e)

        matiere_slots = {
            m: sorted(set(e.heure_debut for e in dj_epreuves if e.matiere == m))
            for m in matieres_sorted
        }
        first_slots = set(matiere_slots[matieres_sorted[0]])
        all_same_times = all(
            set(matiere_slots[m]) == first_slots for m in matieres_sorted[1:]
        )

        triplet_candidates: list = []

        if all_same_times:
            all_slots = sorted(first_slots)
            total_slots = len(all_slots)
            n_sq = N_rooms * N_rooms
            offset = N_rooms
            rounds = total_slots // n_sq if n_sq else 0
            for round_idx in range(rounds):
                base = round_idx * n_sq
                for k in range(n_sq):
                    candidate: list = []
                    valid = True
                    for i, matiere in enumerate(matieres_sorted):
                        slot_idx = base + k + i * offset
                        if slot_idx >= total_slots:
                            valid = False
                            break
                        ep_list = libres_multi.get((matiere, all_slots[slot_idx]), [])
                        if not ep_list:
                            valid = False
                            break
                        candidate.append(ep_list[0])
                    if valid and candidate:
                        triplet_candidates.append(candidate)
        else:
            S = min(len(matiere_slots[m]) for m in matieres_sorted)
            for k in range(S):
                candidate = []
                valid = True
                for matiere in matieres_sorted:
                    slot = matiere_slots[matiere][k]
                    ep_list = libres_multi.get((matiere, slot), [])
                    if not ep_list:
                        valid = False
                        break
                    candidate.append(ep_list[0])
                if valid and candidate:
                    triplet_candidates.append(candidate)

        for assigned in triplet_candidates:
            heure_debut_first = min(e.heure_debut for e in assigned)
            if heure_debut_first == body.heure_debut:
                epreuves_a_attribuer = assigned
                djs_ref = [dj] * len(assigned)
                break

        if epreuves_a_attribuer is not None:
            break

    if epreuves_a_attribuer is None:
        raise HTTPException(status_code=400, detail="Créneau de départ invalide ou indisponible.")

    # Annuler l'inscription existante (swap atomique)
    ancienne = (
        db.query(Inscription)
        .filter_by(candidat_id=candidat_id, statut="ACTIVE")
        .first()
    )
    if ancienne:
        for ie in ancienne.epreuves:
            ie.epreuve.candidat_id = None
            ie.epreuve.statut = "LIBRE"
        ancienne.statut = "ANNULEE"
        ancienne.cancelled_at = _now_utc()

    # Créer la nouvelle inscription
    nouvelle = Inscription(candidat_id=candidat_id, statut="ACTIVE")
    db.add(nouvelle)
    db.flush()

    epreuves_out = []
    for e in epreuves_a_attribuer:
        e.candidat_id = candidat_id
        e.statut = "ATTRIBUEE"
        db.add(InscriptionEpreuve(inscription_id=nouvelle.id, epreuve_id=e.id))
        dj = next(d for d in djs_ref if d.id == e.demi_journee_id)
        epreuves_out.append(
            TripletEpreuveOut(
                id=e.id,
                matiere=e.matiere,
                heure_debut=str(e.heure_debut)[:5],
                heure_fin=str(e.heure_fin)[:5],
                heure_prepa=_heure_prepa(e.heure_debut, e.preparation_minutes),
                demi_journee_type=dj.type,
            )
        )

    candidat.statut = "INSCRIT"
    db.commit()
    if planning.envoyer_convocations:
        pass  # TODO: envoyer Message-type Convocation par email

    return InscriptionActiveOut(
        id=nouvelle.id,
        date=body.date,
        statut="ACTIVE",
        epreuves=sorted(epreuves_out, key=lambda x: x.heure_debut),
    )


@router.delete("/me/inscriptions/{inscription_id}", status_code=204)
def annuler_inscription(
    inscription_id: int,
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """Annule l'inscription active du candidat."""
    insc = db.get(Inscription, inscription_id)
    if not insc or insc.candidat_id != candidat_id or insc.statut != "ACTIVE":
        raise HTTPException(status_code=404, detail="Inscription introuvable")

    planning = db.get(Planning, db.get(Candidat, candidat_id).planning_id)
    if planning.statut != "OUVERT":
        raise HTTPException(status_code=403, detail="Les inscriptions ne sont pas ouvertes.")
    if planning.interdire_changement_creneau:
        raise HTTPException(status_code=403, detail="La désinscription est interdite pour ce planning.")
    now = _now_utc()
    if now > _ensure_naive(planning.date_fermeture_inscriptions):
        raise HTTPException(status_code=403, detail="La période d'inscription est terminée.")
    # Vérifier le préavis sur la date du triplet
    first_dj = db.get(DemiJournee, insc.epreuves[0].epreuve.demi_journee_id)
    cutoff = _cutoff_date(planning)
    if first_dj.date < cutoff:
        raise HTTPException(
            status_code=400,
            detail="La date de préavis est dépassée, vous ne pouvez plus vous désinscrire.",
        )

    for ie in insc.epreuves:
        ie.epreuve.candidat_id = None
        ie.epreuve.statut = "LIBRE"
    insc.statut = "ANNULEE"
    insc.cancelled_at = _now_utc()
    db.get(Candidat, candidat_id).statut = "IMPORTE"
    db.commit()
    # TODO: envoyer Message-type Désinscription


# ── Notes (JWT) ───────────────────────────────────────────────────────────────

@router.get("/me/notes", response_model=List[NoteOut])
def get_notes(
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """Retourne uniquement les notes publiées du candidat."""
    notes = (
        db.query(Note)
        .filter_by(candidat_id=candidat_id, statut="PUBLIE")
        .order_by(Note.matiere)
        .all()
    )
    return notes


# ── Liste d'attente (JWT) ─────────────────────────────────────────────────────

@router.get("/me/liste-attente", response_model=ListeAttenteOut)
def get_liste_attente(
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """
    Retourne :
    - les journées cochées par le candidat
    - les journées disponibles à partir de J+1 ayant des épreuves
    """
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat introuvable")

    planning = db.get(Planning, c.planning_id)
    cutoff = _cutoff_date(planning)

    # Journées disponibles = dates avec au moins 1 épreuve LIBRE à partir de J+1
    from collections import defaultdict
    djs = (
        db.query(DemiJournee)
        .filter(
            DemiJournee.planning_id == c.planning_id,
            DemiJournee.date >= cutoff,
        )
        .order_by(DemiJournee.date)
        .all()
    )
    by_date: dict = defaultdict(int)
    for dj in djs:
        count = (
            db.query(Epreuve)
            .filter(Epreuve.demi_journee_id == dj.id, Epreuve.statut == "LIBRE")
            .count()
        )
        by_date[dj.date] += count

    journees = [
        JourneeDisponibleOut(date=d, nb_epreuves=n)
        for d, n in sorted(by_date.items())
        if n > 0
    ]

    # Dates déjà cochées
    cochees = [
        la.date
        for la in db.query(ListeAttente).filter_by(candidat_id=candidat_id).all()
    ]

    return ListeAttenteOut(dates_cochees=cochees, journees_disponibles=journees)


@router.put("/me/liste-attente", status_code=204)
def update_liste_attente(
    body: ListeAttenteIn,
    candidat_id: int = Depends(require_candidat),
    db: Session = Depends(get_db),
):
    """
    Remplace les disponibilités du candidat.
    Interdit si le candidat est déjà inscrit à un triplet.
    """
    # Vérifier qu'il n'est pas déjà inscrit
    inscrit = (
        db.query(Inscription)
        .filter_by(candidat_id=candidat_id, statut="ACTIVE")
        .first()
    )
    if inscrit:
        raise HTTPException(
            status_code=409,
            detail="Vous êtes déjà inscrit aux oraux. Désinscrivez-vous d'abord.",
        )

    c = db.get(Candidat, candidat_id)
    planning = db.get(Planning, c.planning_id)
    cutoff = _cutoff_date(planning)

    # Valider que toutes les dates sont >= cutoff
    for d in body.dates:
        if d < cutoff:
            raise HTTPException(
                status_code=400,
                detail=f"La date {d} n'est pas disponible (préavis dépassé).",
            )

    # Supprimer les anciennes entrées et recréer
    db.query(ListeAttente).filter_by(candidat_id=candidat_id).delete()
    for d in body.dates:
        db.add(ListeAttente(candidat_id=candidat_id, date=d))
    db.commit()
    # TODO: envoyer Message-type Liste d'attente si nouvelles dates ajoutées


# ── Inscription (legacy code) ──────────────────────────────────────────────────

@router.post("/inscription")
def s_inscrire(body: InscriptionIn, code: str = Query(...), db: Session = Depends(get_db)):
    c = db.query(Candidat).filter_by(code_acces=code.upper()).first()
    if not c:
        raise HTTPException(status_code=404, detail="Code invalide")

    e = db.get(Epreuve, body.epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if e.statut != "LIBRE":
        raise HTTPException(status_code=409, detail="Ce créneau n'est plus disponible")

    dj = db.get(DemiJournee, e.demi_journee_id)
    if dj.planning_id != c.planning_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    e.candidat_id = c.id
    e.statut = "ATTRIBUEE"
    db.commit()
    return {"epreuve_id": e.id, "statut": "ATTRIBUEE"}


@router.delete("/inscription/{epreuve_id}")
def se_desinscrire(epreuve_id: int, code: str = Query(...), db: Session = Depends(get_db)):
    c = db.query(Candidat).filter_by(code_acces=code.upper()).first()
    if not c:
        raise HTTPException(status_code=404, detail="Code invalide")

    e = db.get(Epreuve, epreuve_id)
    if not e or e.candidat_id != c.id:
        raise HTTPException(status_code=404, detail="Inscription introuvable")

    e.candidat_id = None
    e.statut = "LIBRE"
    db.commit()
    return {"epreuve_id": e.id, "statut": "LIBRE"}
