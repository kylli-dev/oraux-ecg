"""
Interface de gestion des candidats pour le service des admissions.
Permet de visualiser la fiche, l'inscription et la liste d'attente d'un candidat,
et d'assigner / désinscrire / préréserver des triplets de créneaux.
"""
from collections import defaultdict
from datetime import date as Date, datetime, timezone, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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
    statut: str = "ATTRIBUEE"


class TripletOut(BaseModel):
    date: Date
    heure_debut: str        # "HH:MM"
    epreuves: List[TripletEpreuveOut]
    type_slot: str          # "LIBRE" | "PRERESERVEE" | "ATTRIBUEE" | "INCOMPLET" | "INDISPONIBLE"
    candidat_id: Optional[int] = None
    candidat_nom: Optional[str] = None
    candidat_prenom: Optional[str] = None


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


class ListeAttenteAdminDate(BaseModel):
    date: Date
    created_at: datetime


class ListeAttenteAdminItem(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    code_candidat: Optional[str] = None
    civilite: Optional[str] = None
    profil: Optional[str] = None
    dates: List[ListeAttenteAdminDate]
    premier_enregistrement: datetime


class JourneeInscritItem(BaseModel):
    candidat_id: int
    candidat_nom: str
    candidat_prenom: str
    candidat_code: Optional[str] = None
    candidat_profil: Optional[str] = None
    candidat_classe: Optional[str] = None
    inscription_id: int
    epreuves: List[TripletEpreuveOut]


class EpreuveDisponibleOut(BaseModel):
    id: int
    date: Date
    demi_journee_type: str
    matiere: str
    heure_debut: str
    heure_fin: str
    statut: str


class InscrireDirectIn(BaseModel):
    epreuve_ids: List[int]


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
    """Liste tous les candidats d'un planning avec leur statut d'inscription (batch, sans N+1)."""
    candidats = (
        db.query(Candidat)
        .filter_by(planning_id=planning_id)
        .order_by(Candidat.nom, Candidat.prenom)
        .all()
    )
    if not candidats:
        return []

    cids = [c.id for c in candidats]

    # Batch : une seule requête pour les inscriptions actives
    inscriptions = {
        insc.candidat_id: insc
        for insc in db.query(Inscription)
        .filter(Inscription.candidat_id.in_(cids), Inscription.statut == "ACTIVE")
        .all()
    }

    # Batch : une seule requête pour la liste d'attente
    listes_attente = {
        la.candidat_id
        for la in db.query(ListeAttente)
        .filter(ListeAttente.candidat_id.in_(cids))
        .all()
    }

    return [
        CandidatListeItem(
            id=c.id,
            nom=c.nom,
            prenom=c.prenom,
            email=c.email,
            code_candidat=c.code_candidat,
            civilite=c.civilite,
            is_inscrit=c.id in inscriptions,
            inscription_id=inscriptions[c.id].id if c.id in inscriptions else None,
            is_liste_attente=c.id in listes_attente,
            statut=c.statut,
        )
        for c in candidats
    ]


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


_PROFIL_EXCLUSION_ADMIN: dict = {"HGG": "ESH", "ESH": "HGG"}


def _triplets_pour_groupe(all_epreuves: list, date, seen_global: set) -> list:
    """
    Calcule les triplets N² DISPONIBLES (LIBRE/PRERESERVEE) pour un groupe d'épreuves
    (un profil ou la journée entière) — comportement historique, inchangé.

    Ne considère jamais les épreuves ATTRIBUEE : avec du dédoublement (plusieurs épreuves
    en parallèle sur la même matière + heure), la formule de rotation ne sait pas quelle
    salle parallèle correspond à quel candidat — mélanger une salle ATTRIBUEE à une autre
    salle LIBRE de la même case (matière, heure) produirait un faux triplet. Les triplets
    déjà attribués sont donc reconstruits séparément, à partir des vraies inscriptions
    (voir get_triplets_admin) plutôt que devinés par cette formule.
    """
    if not all_epreuves:
        return []

    all_slots = sorted(set(e.heure_debut for e in all_epreuves))
    matieres_sorted = sorted(set(e.matiere for e in all_epreuves))
    N_rooms = len(matieres_sorted)
    total_slots = len(all_slots)
    offset = total_slots // N_rooms if N_rooms else 1

    disponibles: dict = defaultdict(list)
    for e in all_epreuves:
        if e.statut in ("LIBRE", "PRERESERVEE"):
            disponibles[(e.matiere, e.heure_debut)].append(e)

    result = []
    for k in range(total_slots):
        assigned = []
        valid = True
        for i, matiere in enumerate(matieres_sorted):
            slot_idx = (k + i * offset) % total_slots
            ep_list = disponibles.get((matiere, all_slots[slot_idx]), [])
            if not ep_list:
                valid = False
                break
            assigned.append(ep_list[0])

        if not valid or not assigned:
            continue

        key = frozenset(e.id for e in assigned)
        if key in seen_global:
            continue
        seen_global.add(key)

        # Quand une journée mélange ESH et HGG, Maths et Anglais sont partagés entre le
        # triplet "vue ESH" et le triplet "vue HGG" au même horaire (seule la 3e matière
        # change) — les deux ne sont pas 2 ressources indépendantes, mais 2 complétions
        # possibles des MÊMES créneaux Maths/Anglais. Préréserver l'un des deux marque donc
        # Maths/Anglais PRERESERVEE, ce qui rendrait l'AUTRE faussement "Préréservé" en
        # entier si on se contentait de tester "au moins un créneau PRERESERVEE" : son
        # propre créneau (ESH ou HGG) resterait pourtant réellement libre. On distingue donc
        # 3 cas : entièrement LIBRE, entièrement PRERESERVEE (c'est CE triplet qui a été
        # préréservé), ou mélange (INDISPONIBLE — bloqué par le triplet jumeau, mais pas
        # préréservé lui-même — ni "Préréserver" ni "Libérer" n'ont de sens dessus).
        statuts = {e.statut for e in assigned}
        if statuts == {"LIBRE"}:
            type_slot = "LIBRE"
        elif statuts == {"PRERESERVEE"}:
            type_slot = "PRERESERVEE"
        else:
            type_slot = "INDISPONIBLE"
        epreuves_out = sorted([
            TripletEpreuveOut(
                id=e.id,
                matiere=e.matiere,
                heure_debut=str(e.heure_debut)[:5],
                heure_fin=str(e.heure_fin)[:5],
                statut=e.statut,
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


def _triplets_attribues(planning_id: int, db: Session) -> list:
    """
    Reconstruit les triplets déjà ATTRIBUES à partir des vraies inscriptions (Inscription +
    InscriptionEpreuve) plutôt que de les redeviner via la formule de rotation — seule
    source fiable en présence de dédoublement (la formule de rotation seule ne peut pas
    savoir quelle salle parallèle appartient à quel candidat).

    Une épreuve ATTRIBUEE (candidat_id renseigné) sans InscriptionEpreuve correspondante —
    forcément affectée individuellement, hors du flux normal d'inscription — ressort seule,
    en INCOMPLET, plutôt que d'être associée à 2 autres épreuves au hasard.
    """
    result = []
    inscriptions = (
        db.query(Inscription)
        .join(Candidat, Inscription.candidat_id == Candidat.id)
        .filter(Candidat.planning_id == planning_id, Inscription.statut == "ACTIVE")
        .all()
    )
    covered_epreuve_ids: set = set()
    for insc in inscriptions:
        eps = [ie.epreuve for ie in insc.epreuves]
        if not eps:
            continue
        covered_epreuve_ids.update(e.id for e in eps)
        eps_sorted = sorted(eps, key=lambda e: e.heure_debut)
        dj = db.get(DemiJournee, eps_sorted[0].demi_journee_id)
        result.append(TripletOut(
            date=dj.date,
            heure_debut=str(eps_sorted[0].heure_debut)[:5],
            epreuves=[
                TripletEpreuveOut(id=e.id, matiere=e.matiere, heure_debut=str(e.heure_debut)[:5], heure_fin=str(e.heure_fin)[:5], statut=e.statut)
                for e in eps_sorted
            ],
            type_slot="ATTRIBUEE",
            candidat_id=insc.candidat_id,
            candidat_nom=insc.candidat.nom,
            candidat_prenom=insc.candidat.prenom,
        ))

    # Épreuves attribuées hors de toute inscription active (affectation individuelle) —
    # affichées une par une en INCOMPLET plutôt que groupées au hasard avec 2 autres.
    djs = db.query(DemiJournee).filter_by(planning_id=planning_id).all()
    dj_by_id = {dj.id: dj for dj in djs}
    if not dj_by_id:
        return result
    orphelines_q = db.query(Epreuve).filter(
        Epreuve.demi_journee_id.in_(list(dj_by_id.keys())),
        Epreuve.candidat_id.isnot(None),
    )
    if covered_epreuve_ids:
        orphelines_q = orphelines_q.filter(~Epreuve.id.in_(covered_epreuve_ids))
    orphelines = orphelines_q.all()
    for e in orphelines:
        dj = dj_by_id.get(e.demi_journee_id)
        if not dj:
            continue
        result.append(TripletOut(
            date=dj.date,
            heure_debut=str(e.heure_debut)[:5],
            epreuves=[TripletEpreuveOut(id=e.id, matiere=e.matiere, heure_debut=str(e.heure_debut)[:5], heure_fin=str(e.heure_fin)[:5], statut=e.statut)],
            type_slot="INCOMPLET",
            candidat_id=e.candidat_id,
            candidat_nom=e.candidat.nom if e.candidat else None,
            candidat_prenom=e.candidat.prenom if e.candidat else None,
        ))
    return result


def _partition_par_profil(all_epreuves: list) -> tuple:
    """
    Répartit les épreuves d'une journée mixte ESH/HGG en 2 groupes indépendants (vue ESH,
    vue HGG). ESH et HGG vont chacune exclusivement dans leur groupe. Les matières
    COMMUNES aux deux profils (Maths, Anglais...) sont réparties une par une entre les 2
    groupes quand plusieurs épreuves parallèles existent à la même heure (dédoublement /
    salles différentes) : chaque profil obtient alors SA PROPRE salle plutôt que de forcer
    les deux vues à se disputer la même — préréserver l'une n'a plus à rendre l'autre
    "Indisponible" si une 2e salle existe réellement pour cette matière à cette heure.
    S'il n'existe qu'une seule épreuve à cette (matière, heure) — pas de salle en
    parallèle —, les deux groupes la partagent comme avant : c'est alors une vraie
    contrainte physique (une seule salle), pas un choix arbitraire de l'algorithme.
    """
    esh_groupe: list = []
    hgg_groupe: list = []
    partage: dict = defaultdict(list)
    for e in all_epreuves:
        m = e.matiere.upper()
        if m == "ESH":
            esh_groupe.append(e)
        elif m == "HGG":
            hgg_groupe.append(e)
        else:
            partage[(e.matiere, e.heure_debut)].append(e)

    for eps in partage.values():
        eps_sorted = sorted(eps, key=lambda e: e.id)
        if len(eps_sorted) >= 2:
            esh_groupe.append(eps_sorted[0])
            hgg_groupe.append(eps_sorted[1])
            # Dédoublement à >2 salles parallèles (rare) : le surplus reste partagé entre
            # les 2 vues plutôt que d'inventer une 3e vue.
            for extra in eps_sorted[2:]:
                esh_groupe.append(extra)
                hgg_groupe.append(extra)
        else:
            esh_groupe.extend(eps_sorted)
            hgg_groupe.extend(eps_sorted)

    return esh_groupe, hgg_groupe


@router.get("/{planning_id}/triplets", response_model=List[TripletOut])
def get_triplets_admin(planning_id: int, tous: bool = False, db: Session = Depends(get_db)):
    """
    Retourne les triplets du planning (admin : sans cutoff de date).

    Par défaut (tous=False), seuls les triplets disponibles (LIBRE/PRERESERVEE) — c'est
    ce que consomment les écrans d'inscription, qui ne doivent proposer que des places
    libres. Avec tous=True, ajoute aussi les triplets déjà ATTRIBUES (reconstruits à partir
    des vraies inscriptions, pas devinés) et les épreuves attribuées individuellement hors
    inscription (INCOMPLET) — pour la Vue triplets qui doit montrer l'état réel de chaque
    triplet.

    Si la journée contient ESH et HGG, génère des triplets séparés par profil
    (sans combiner les deux) pour correspondre à ce que voit chaque candidat.
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

        all_epreuves_raw = (
            db.query(Epreuve)
            .filter(Epreuve.demi_journee_id.in_(dj_ids))
            .order_by(Epreuve.heure_debut, Epreuve.matiere)
            .all()
        )
        if not all_epreuves_raw:
            continue

        matieres_upper = {e.matiere.upper() for e in all_epreuves_raw}
        has_esh = "ESH" in matieres_upper
        has_hgg = "HGG" in matieres_upper

        seen_global: set = set()

        if has_esh and has_hgg:
            # Générer deux groupes séparés : un pour les candidats ESH, un pour HGG — en
            # répartissant les salles parallèles des matières communes entre les deux
            # quand elles existent (voir _partition_par_profil).
            esh_groupe, hgg_groupe = _partition_par_profil(all_epreuves_raw)
            result.extend(_triplets_pour_groupe(esh_groupe, date, seen_global))
            result.extend(_triplets_pour_groupe(hgg_groupe, date, seen_global))
        else:
            result.extend(_triplets_pour_groupe(all_epreuves_raw, date, seen_global))

    if tous:
        result.extend(_triplets_attribues(planning_id, db))

    return result


class TripletEpreuveIdsIn(BaseModel):
    epreuve_ids: List[int]


def _load_triplet_epreuves(planning_id: int, epreuve_ids: List[int], db: Session) -> List[Epreuve]:
    if not epreuve_ids:
        raise HTTPException(status_code=400, detail="Aucune épreuve fournie")
    eps = db.query(Epreuve).filter(Epreuve.id.in_(epreuve_ids)).all()
    if len(eps) != len(set(epreuve_ids)):
        raise HTTPException(status_code=404, detail="Une ou plusieurs épreuves introuvables")
    for e in eps:
        dj = db.get(DemiJournee, e.demi_journee_id)
        if not dj or dj.planning_id != planning_id:
            raise HTTPException(status_code=403, detail=f"Épreuve {e.id} n'appartient pas à ce planning")
    return eps


@router.post("/{planning_id}/triplets/prereserver")
def prereserver_triplet(planning_id: int, body: TripletEpreuveIdsIn, db: Session = Depends(get_db)):
    """
    Marque un triplet LIBRE comme PRERESERVEE, sans lui assigner de candidat — pour le
    réserver (ex. en vue d'un candidat précis) sans le laisser réattribuable librement.
    """
    eps = _load_triplet_epreuves(planning_id, body.epreuve_ids, db)
    non_libres = [e for e in eps if e.statut != "LIBRE"]
    if non_libres:
        raise HTTPException(
            status_code=409,
            detail=f"Épreuve(s) non LIBRE : {', '.join(f'{e.matiere} ({e.statut})' for e in non_libres)}",
        )
    for e in eps:
        e.statut = "PRERESERVEE"
    db.commit()
    return {"updated": len(eps), "statut": "PRERESERVEE"}


@router.post("/{planning_id}/triplets/liberer")
def liberer_triplet(planning_id: int, body: TripletEpreuveIdsIn, db: Session = Depends(get_db)):
    """Repasse un triplet PRERESERVEE en LIBRE (annule la pré-réservation)."""
    eps = _load_triplet_epreuves(planning_id, body.epreuve_ids, db)
    non_prereservees = [e for e in eps if e.statut != "PRERESERVEE"]
    if non_prereservees:
        raise HTTPException(
            status_code=409,
            detail=f"Épreuve(s) non PRERESERVEE : {', '.join(f'{e.matiere} ({e.statut})' for e in non_prereservees)}",
        )
    for e in eps:
        e.statut = "LIBRE"
    db.commit()
    return {"updated": len(eps), "statut": "LIBRE"}


@router.get("/{planning_id}/journee", response_model=List[JourneeInscritItem])
def get_inscrits_journee(
    planning_id: int,
    date: Optional[Date] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Retourne les candidats inscrits pour une journée donnée.
    Sans date : retourne tous les candidats inscrits du planning (toutes dates).
    """
    q = db.query(DemiJournee).filter_by(planning_id=planning_id)
    if date:
        q = q.filter(DemiJournee.date == date)
    djs = q.all()
    dj_ids = [dj.id for dj in djs]
    if not dj_ids:
        return []

    epreuves = (
        db.query(Epreuve)
        .filter(
            Epreuve.demi_journee_id.in_(dj_ids),
            Epreuve.statut.in_(["ATTRIBUEE", "ABSENT"]),
            Epreuve.candidat_id.isnot(None),
        )
        .order_by(Epreuve.heure_debut, Epreuve.matiere)
        .all()
    )

    by_candidat: dict = defaultdict(list)
    for e in epreuves:
        by_candidat[e.candidat_id].append(e)

    result = []
    for cid, eps in by_candidat.items():
        c = db.get(Candidat, cid)
        if not c:
            continue
        insc = _get_active_inscription(cid, db)
        eps_out = sorted([
            TripletEpreuveOut(
                id=e.id,
                matiere=e.matiere,
                heure_debut=str(e.heure_debut)[:5],
                heure_fin=str(e.heure_fin)[:5],
                statut=e.statut,
            )
            for e in eps
        ], key=lambda x: x.heure_debut)
        result.append(JourneeInscritItem(
            candidat_id=cid,
            candidat_nom=c.nom,
            candidat_prenom=c.prenom,
            candidat_code=c.code_candidat,
            candidat_profil=c.profil,
            candidat_classe=getattr(c, "classe", None),
            inscription_id=insc.id if insc else 0,
            epreuves=eps_out,
        ))

    result.sort(key=lambda x: x.epreuves[0].heure_debut if x.epreuves else "")
    return result


@router.get("/{planning_id}/liste-attente", response_model=List[ListeAttenteAdminItem])
def list_liste_attente_admin(planning_id: int, db: Session = Depends(get_db)):
    """
    Retourne tous les candidats en liste d'attente pour ce planning,
    avec les dates pour lesquelles ils ont indiqué des disponibilités.
    """
    rows = (
        db.query(ListeAttente)
        .join(Candidat, ListeAttente.candidat_id == Candidat.id)
        .filter(Candidat.planning_id == planning_id)
        .order_by(Candidat.nom, Candidat.prenom, ListeAttente.date)
        .all()
    )

    # Group by candidat
    by_candidat: dict = defaultdict(list)
    candidats_map: dict = {}
    for la in rows:
        by_candidat[la.candidat_id].append(la)
        if la.candidat_id not in candidats_map:
            candidats_map[la.candidat_id] = la.candidat

    result = []
    for cid, las in by_candidat.items():
        c = candidats_map[cid]
        dates = [ListeAttenteAdminDate(date=la.date, created_at=la.created_at) for la in las]
        dates.sort(key=lambda x: x.date)
        premier = min(la.created_at for la in las)
        result.append(ListeAttenteAdminItem(
            id=cid,
            nom=c.nom,
            prenom=c.prenom,
            email=c.email,
            code_candidat=c.code_candidat,
            civilite=c.civilite,
            profil=getattr(c, "profil", None),
            dates=dates,
            premier_enregistrement=premier,
        ))

    result.sort(key=lambda x: x.premier_enregistrement)
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

    all_epreuves_raw = (
        db.query(Epreuve)
        .filter(Epreuve.demi_journee_id.in_(dj_ids))
        .order_by(Epreuve.heure_debut, Epreuve.matiere)
        .all()
    )

    # Appliquer le même filtrage profil que get_triplets_admin
    profil_upper = ""
    if c.profil:
        profil_upper = c.profil.strip().upper()
    elif c.classe:
        cl = c.classe.upper()
        if "ESH" in cl:
            profil_upper = "ESH"
        elif "HGG" in cl:
            profil_upper = "HGG"
    matiere_exclue = _PROFIL_EXCLUSION_ADMIN.get(profil_upper)
    all_epreuves_day = (
        [e for e in all_epreuves_raw if e.matiere.upper() != matiere_exclue]
        if matiere_exclue else all_epreuves_raw
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

    # Supprimer les entrées de liste d'attente du candidat
    db.query(ListeAttente).filter_by(candidat_id=candidat_id).delete()

    c.statut = "INSCRIT"
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
    c = db.get(Candidat, candidat_id)
    c.statut = "IMPORTE"
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
    c = db.get(Candidat, candidat_id)
    c.statut = "IMPORTE"
    db.commit()
    # TODO: envoyer Message-type Désinscription
    return {"candidat_id": candidat_id, "statut": "ANNULEE", "epreuves_statut": "PRERESERVEE"}


@router.get("/{planning_id}/epreuves-disponibles", response_model=List[EpreuveDisponibleOut])
def get_epreuves_disponibles(
    planning_id: int,
    date: Optional[Date] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Retourne toutes les épreuves LIBRE ou PRERESERVEE d'un planning,
    filtrées par date si fournie. Permet l'assignation libre hors rotation N².
    """
    q = (
        db.query(Epreuve, DemiJournee)
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(
            DemiJournee.planning_id == planning_id,
            Epreuve.statut.in_(["LIBRE", "PRERESERVEE"]),
        )
    )
    if date:
        q = q.filter(DemiJournee.date == date)
    q = q.order_by(DemiJournee.date, Epreuve.matiere, Epreuve.heure_debut)

    return [
        EpreuveDisponibleOut(
            id=ep.id,
            date=dj.date,
            demi_journee_type=dj.type,
            matiere=ep.matiere,
            heure_debut=str(ep.heure_debut)[:5],
            heure_fin=str(ep.heure_fin)[:5],
            statut=ep.statut,
        )
        for ep, dj in q.all()
    ]


@router.post("/candidat/{candidat_id}/inscrire-direct")
def admin_inscrire_direct(
    candidat_id: int,
    body: InscrireDirectIn,
    db: Session = Depends(get_db),
):
    """
    Inscrit un candidat à un ensemble d'épreuves quelconques (liberté totale).
    Aucune contrainte de rotation N² : l'admin choisit exactement quelles épreuves attribuer.
    Si déjà inscrit : swap atomique (annule l'ancienne → LIBRE, crée la nouvelle).
    """
    c = db.get(Candidat, candidat_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidat not found")

    if not body.epreuve_ids:
        raise HTTPException(status_code=400, detail="Aucune épreuve sélectionnée")

    # Charger et valider les épreuves
    epreuves_a_attribuer = []
    for ep_id in body.epreuve_ids:
        ep = db.get(Epreuve, ep_id)
        if not ep:
            raise HTTPException(status_code=404, detail=f"Épreuve {ep_id} introuvable")
        dj = db.get(DemiJournee, ep.demi_journee_id)
        if dj.planning_id != c.planning_id:
            raise HTTPException(status_code=403, detail=f"Épreuve {ep_id} n'appartient pas au planning du candidat")
        if ep.statut not in ("LIBRE", "PRERESERVEE", "ABSENT"):
            raise HTTPException(status_code=409, detail=f"Épreuve {ep_id} ({ep.matiere} {str(ep.heure_debut)[:5]}) n'est pas disponible (statut: {ep.statut})")
        epreuves_a_attribuer.append(ep)

    # Annuler l'inscription précédente si existante
    ancienne = _get_active_inscription(candidat_id, db)
    if ancienne:
        _cancel_inscription(ancienne, "LIBRE", db)

    nouvelle = Inscription(candidat_id=candidat_id, statut="ACTIVE")
    db.add(nouvelle)
    db.flush()

    for ep in epreuves_a_attribuer:
        ep.candidat_id = candidat_id
        ep.statut = "ATTRIBUEE"
        db.add(InscriptionEpreuve(inscription_id=nouvelle.id, epreuve_id=ep.id))

    db.query(ListeAttente).filter_by(candidat_id=candidat_id).delete()
    c.statut = "INSCRIT"
    db.commit()
    return {"candidat_id": candidat_id, "inscription_id": nouvelle.id, "statut": "ACTIVE", "nb_epreuves": len(epreuves_a_attribuer)}


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
    c = db.get(Candidat, candidat_id)
    c.statut = "IMPORTE"
    db.commit()
    return {"candidat_id": candidat_id, "statut": "ANNULEE", "epreuves_statut": "LIBRE"}


@router.post("/candidat/{candidat_id}/epreuve/{epreuve_id}/marquer-absent")
def admin_marquer_absent(candidat_id: int, epreuve_id: int, db: Session = Depends(get_db)):
    """
    Marque une épreuve individuelle comme ABSENT.
    L'inscription reste active, les autres épreuves du triplet restent ATTRIBUEE.
    La salle libérée devient réaffectable via inscrire-direct.
    """
    ep = db.get(Epreuve, epreuve_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if ep.candidat_id != candidat_id:
        raise HTTPException(status_code=403, detail="Cette épreuve n'appartient pas à ce candidat")
    if ep.statut != "ATTRIBUEE":
        raise HTTPException(status_code=400, detail=f"Statut actuel {ep.statut!r} — seule une épreuve ATTRIBUEE peut être marquée absente")
    ep.statut = "ABSENT"
    db.commit()
    return {"epreuve_id": epreuve_id, "statut": "ABSENT"}


@router.delete("/candidat/{candidat_id}/epreuve/{epreuve_id}/marquer-absent")
def admin_annuler_absent(candidat_id: int, epreuve_id: int, db: Session = Depends(get_db)):
    """
    Annule le marquage d'absence : remet l'épreuve en ATTRIBUEE (candidat présent finalement).
    """
    ep = db.get(Epreuve, epreuve_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if ep.candidat_id != candidat_id:
        raise HTTPException(status_code=403, detail="Cette épreuve n'appartient pas à ce candidat")
    if ep.statut != "ABSENT":
        raise HTTPException(status_code=400, detail=f"L'épreuve n'est pas en statut ABSENT (statut: {ep.statut!r})")
    ep.statut = "ATTRIBUEE"
    db.commit()
    return {"epreuve_id": epreuve_id, "statut": "ATTRIBUEE"}
