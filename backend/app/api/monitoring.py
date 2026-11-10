"""
Onglet Monitoring (super-administrateurs) : qui est en ligne, fréquentation par heure,
journal des actions. Données écrites par services/monitoring.py.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin, require_super_admin
from app.db.deps import get_db
from app.models.admin import Admin
from app.models.audit_log import AuditLog
from app.models.candidat import Candidat
from app.models.examinateur import Examinateur
from app.models.surveillant import Surveillant
from app.services.monitoring import JOURS_CONSERVATION, libelle_action, maintenant_utc

router = APIRouter(
    prefix="/admin/monitoring",
    tags=["monitoring"],
    dependencies=[Depends(require_admin), Depends(require_super_admin)],
)

PARIS = ZoneInfo("Europe/Paris")
TYPES = ("admin", "candidat", "examinateur", "surveillant", "anonyme")


def _iso_utc(d: datetime) -> str:
    return d.replace(tzinfo=timezone.utc).isoformat()


def _noms(db: Session, lignes) -> dict:
    """{(type, id): nom affiché} pour les acteurs des lignes données."""
    ids = defaultdict(set)
    for l in lignes:
        if l.acteur_id is not None:
            ids[l.acteur_type].add(l.acteur_id)
    noms = {}
    for modele, t, fmt in (
        (Candidat, "candidat", lambda o: f"{o.prenom} {o.nom}"),
        (Examinateur, "examinateur", lambda o: f"{o.prenom} {o.nom}"),
        (Surveillant, "surveillant", lambda o: f"{o.prenom} {o.nom}"),
        (Admin, "admin", lambda o: o.username),
    ):
        if ids[t]:
            for o in db.query(modele).filter(modele.id.in_(ids[t])).all():
                noms[(t, o.id)] = fmt(o)
    return noms


def _nom(noms: dict, l) -> str:
    if (l.acteur_type, l.acteur_id) in noms:
        return noms[(l.acteur_type, l.acteur_id)]
    if l.acteur_nom:
        return l.acteur_nom
    if l.acteur_type == "anonyme":
        return "Anonyme"
    return f"{l.acteur_type} (non identifié)" if l.acteur_id is None else f"{l.acteur_type} n°{l.acteur_id} (supprimé)"


class EnLigneOut(BaseModel):
    acteur_type: str
    acteur_id: Optional[int]
    nom: str
    derniere_activite: str
    derniere_action: str


@router.get("/en-ligne", response_model=List[EnLigneOut])
def en_ligne(minutes: int = Query(10, ge=1, le=240), db: Session = Depends(get_db)):
    """Personnes identifiées actives sur les `minutes` dernières minutes, la plus récente d'abord."""
    lignes = (
        db.query(AuditLog)
        .filter(AuditLog.created_at >= maintenant_utc() - timedelta(minutes=minutes), AuditLog.acteur_type != "anonyme")
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    noms = _noms(db, lignes)
    vus, out = set(), []
    for l in lignes:
        cle = (l.acteur_type, l.acteur_id, l.acteur_nom if l.acteur_id is None else None)
        if cle in vus:
            continue
        vus.add(cle)
        out.append(EnLigneOut(
            acteur_type=l.acteur_type, acteur_id=l.acteur_id, nom=_nom(noms, l),
            derniere_activite=_iso_utc(l.created_at),
            derniere_action=l.detail or libelle_action(l.methode, l.route, l.chemin),
        ))
    return out


class JournalOut(BaseModel):
    id: int
    date: str
    acteur_type: str
    acteur_id: Optional[int]
    nom: str
    action: str
    methode: str
    chemin: str
    statut_http: int
    duree_ms: int


@router.get("/journal", response_model=List[JournalOut])
def journal(
    acteur_type: Optional[str] = None,
    avec_consultations: bool = False,
    avant_id: Optional[int] = None,
    limite: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Actions les plus récentes d'abord ; `avant_id` pour charger la page suivante."""
    q = db.query(AuditLog)
    if acteur_type in TYPES:
        q = q.filter(AuditLog.acteur_type == acteur_type)
    if not avec_consultations:
        q = q.filter(AuditLog.methode != "GET")
    if avant_id is not None:
        q = q.filter(AuditLog.id < avant_id)
    lignes = q.order_by(AuditLog.id.desc()).limit(limite).all()
    noms = _noms(db, lignes)
    return [
        JournalOut(
            id=l.id, date=_iso_utc(l.created_at), acteur_type=l.acteur_type, acteur_id=l.acteur_id,
            nom=_nom(noms, l), action=l.detail or libelle_action(l.methode, l.route, l.chemin),
            methode=l.methode, chemin=l.chemin, statut_http=l.statut_http, duree_ms=l.duree_ms,
        )
        for l in lignes
    ]


class FrequentationOut(BaseModel):
    jours: int
    # moyenne[jour de la semaine 0 = lundi][heure 0-23] : nombre moyen de personnes actives
    moyenne: List[List[float]]
    maximum: List[List[int]]
    conservation_jours: int


@router.get("/frequentation", response_model=FrequentationOut)
def frequentation(jours: int = Query(14, ge=1, le=JOURS_CONSERVATION), db: Session = Depends(get_db)):
    """
    Nombre de personnes différentes actives par heure (heure de Paris), en moyenne par jour de
    la semaine sur la période : sert à choisir un moment calme pour déployer.
    """
    debut = maintenant_utc() - timedelta(days=jours)
    lignes = (
        db.query(AuditLog.created_at, AuditLog.acteur_type, AuditLog.acteur_id, AuditLog.acteur_nom)
        .filter(AuditLog.created_at >= debut, AuditLog.acteur_type != "anonyme")
        .all()
    )
    par_heure = defaultdict(set)  # (date locale, heure) -> acteurs
    for created_at, t, i, n in lignes:
        local = created_at.replace(tzinfo=timezone.utc).astimezone(PARIS)
        par_heure[(local.date(), local.hour)].add((t, i, n if i is None else None))

    # Nombre d'occurrences de chaque jour de la semaine dans la période (pour la moyenne)
    aujourd_hui = datetime.now(PARIS).date()
    occurrences = [0] * 7
    for k in range(jours):
        occurrences[(aujourd_hui - timedelta(days=k)).weekday()] += 1

    total = [[0] * 24 for _ in range(7)]
    maximum = [[0] * 24 for _ in range(7)]
    for (d, h), acteurs in par_heure.items():
        total[d.weekday()][h] += len(acteurs)
        maximum[d.weekday()][h] = max(maximum[d.weekday()][h], len(acteurs))
    moyenne = [[round(total[j][h] / occurrences[j], 1) if occurrences[j] else 0.0 for h in range(24)] for j in range(7)]
    return FrequentationOut(jours=jours, moyenne=moyenne, maximum=maximum, conservation_jours=JOURS_CONSERVATION)
