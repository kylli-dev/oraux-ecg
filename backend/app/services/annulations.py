"""
Annulation des grosses actions de l'admin, pendant 24 h.

Deux sortes d'action :
  - DATE : l'action remplace ou supprime une date entière (application d'un gabarit,
    suppression d'une journée). On garde un instantané de la date avant l'action — demi-
    journées, épreuves avec leurs affectations, liens d'inscription, statut des inscriptions
    et des candidats touchés — et la signature de la date juste après. L'annulation n'est
    possible que si la date n'a pas bougé depuis (sinon on effacerait un travail fait après).
  - CHAMPS : l'action modifie des champs d'épreuves (affectation groupée, salles par défaut,
    numérotation des triplets) et éventuellement le tableau des salles par défaut. On garde,
    par épreuve, les valeurs avant et après ; l'annulation remet l'ancienne valeur seulement
    là où la valeur actuelle est encore celle posée par l'action.
"""
from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, Optional

from fastapi import Request
from sqlalchemy import Date, DateTime, Time, insert, inspect
from sqlalchemy.orm import Session
from urllib.parse import unquote

from app.models.annulation import Annulation
from app.models.candidat import Candidat
from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.inscription import Inscription, InscriptionEpreuve
from app.models.planche_historique import PlancheHistorique
from app.models.planning_salle_defaut import PlanningMatiereSalleDefaut

DUREE = timedelta(hours=24)


class AnnulationImpossible(Exception):
    """Raison lisible pour laquelle l'action ne peut plus être annulée."""


def _maintenant() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Lignes de table ⇄ JSON ────────────────────────────────────────────────────

def _ser(v):
    if isinstance(v, (datetime, date, time)):
        return v.isoformat()
    return v


def _ligne(obj) -> dict:
    """Toutes les colonnes d'un objet, par nom de colonne, sérialisables en JSON."""
    return {attr.columns[0].name: _ser(getattr(obj, attr.key)) for attr in inspect(obj).mapper.column_attrs}


def _relire(table, d: dict) -> dict:
    """Ligne JSON → valeurs Python selon le type des colonnes (dates, heures)."""
    out = {}
    for col in table.columns:
        if col.name not in d:
            continue
        v = d[col.name]
        if v is not None:
            if isinstance(col.type, DateTime):
                v = datetime.fromisoformat(v)
            elif isinstance(col.type, Date):
                v = date.fromisoformat(v)
            elif isinstance(col.type, Time):
                v = time.fromisoformat(v)
        out[col.name] = v
    return out


def _acteur(request: Optional[Request]) -> tuple:
    if request is None:
        return None, None
    brut = request.headers.get("x-admin-id")
    nom = unquote(request.headers.get("x-admin-username") or "") or None
    return (int(brut) if brut and brut.isdigit() else None), nom


def _enregistrer(db: Session, request, type_: str, planning_id: int, libelle: str, donnees: dict) -> Annulation:
    admin_id, admin_nom = _acteur(request)
    a = Annulation(
        created_at=_maintenant(), type=type_, planning_id=planning_id, libelle=libelle[:300],
        admin_id=admin_id, admin_nom=admin_nom, donnees=json.dumps(donnees),
    )
    db.add(a)
    db.commit()
    return a


# ── DATE : instantané d'une date entière ─────────────────────────────────────

def _epreuves_date(db: Session, planning_id: int, jour: date):
    djs = db.query(DemiJournee).filter_by(planning_id=planning_id, date=jour).order_by(DemiJournee.id).all()
    eps = (
        db.query(Epreuve).filter(Epreuve.demi_journee_id.in_([d.id for d in djs])).order_by(Epreuve.id).all()
        if djs else []
    )
    return djs, eps


def signature_date(db: Session, planning_id: int, jour: date) -> list:
    """État complet de la date (demi-journées, épreuves, liens) pour vérifier qu'elle n'a pas bougé."""
    djs, eps = _epreuves_date(db, planning_id, jour)
    ids = [e.id for e in eps]
    liens = db.query(InscriptionEpreuve).filter(InscriptionEpreuve.epreuve_id.in_(ids)).all() if ids else []
    return [
        [_ligne(d) for d in djs],
        [_ligne(e) for e in eps],
        sorted((l.inscription_id, l.epreuve_id) for l in liens),
    ]


def instantane_date(db: Session, planning_id: int, jour: date) -> dict:
    djs, eps = _epreuves_date(db, planning_id, jour)
    ids = [e.id for e in eps]
    liens = db.query(InscriptionEpreuve).filter(InscriptionEpreuve.epreuve_id.in_(ids)).all() if ids else []
    inscriptions = (
        db.query(Inscription).filter(Inscription.id.in_({l.inscription_id for l in liens})).all() if liens else []
    )
    candidats = (
        db.query(Candidat).filter(Candidat.id.in_({i.candidat_id for i in inscriptions})).all() if inscriptions else []
    )
    historique = (
        db.query(PlancheHistorique).filter(PlancheHistorique.epreuve_id.in_(ids)).all() if ids else []
    )
    return {
        "date": jour.isoformat(),
        "demi_journees": [_ligne(d) for d in djs],
        "epreuves": [_ligne(e) for e in eps],
        "liens": [_ligne(l) for l in liens],
        "inscriptions": [{"id": i.id, "candidat_id": i.candidat_id, "statut": i.statut, "cancelled_at": _ser(i.cancelled_at)} for i in inscriptions],
        "candidats": [{"id": c.id, "statut": c.statut} for c in candidats],
        "historique": [{"id": h.id, "epreuve_id": h.epreuve_id} for h in historique],
    }


def enregistrer_date(db: Session, request, planning_id: int, jour: date, avant: dict, libelle: str) -> Annulation:
    """À appeler juste après l'action (validée) : garde l'avant et la signature de l'après."""
    return _enregistrer(db, request, "DATE", planning_id, libelle, {
        "avant": avant, "apres": signature_date(db, planning_id, jour),
    })


def _restaurer_date(db: Session, planning_id: int, d: dict) -> str:
    avant = d["avant"]
    jour = date.fromisoformat(avant["date"])
    # Signature recalculée comme à l'enregistrement (aller-retour JSON pour comparer à l'identique)
    actuelle = json.loads(json.dumps(signature_date(db, planning_id, jour)))
    if actuelle != d["apres"]:
        raise AnnulationImpossible(
            f"La journée du {jour.strftime('%d/%m/%Y')} a été modifiée depuis (affectations, inscriptions "
            "ou épreuves) : l'annuler effacerait ce travail."
        )
    # Une inscription annulée par l'action ne doit pas revenir si le candidat s'est réinscrit depuis
    a_reactiver = [i for i in avant["inscriptions"] if i["statut"] == "ACTIVE"]
    for i in a_reactiver:
        insc = db.get(Inscription, i["id"])
        if insc and insc.statut != "ACTIVE":
            autre = db.query(Inscription).filter(
                Inscription.candidat_id == i["candidat_id"], Inscription.statut == "ACTIVE", Inscription.id != i["id"],
            ).first()
            if autre:
                raise AnnulationImpossible(
                    "Un candidat de cette journée s'est réinscrit ailleurs depuis : l'annulation lui "
                    "rendrait deux inscriptions."
                )

    # 1. Retirer l'état actuel de la date (épreuves puis demi-journées)
    djs, eps = _epreuves_date(db, planning_id, jour)
    ids = [e.id for e in eps]
    if ids:
        db.query(PlancheHistorique).filter(PlancheHistorique.epreuve_id.in_(ids)).update(
            {PlancheHistorique.epreuve_id: None}, synchronize_session=False)
        db.query(InscriptionEpreuve).filter(InscriptionEpreuve.epreuve_id.in_(ids)).delete(synchronize_session=False)
        db.query(Epreuve).filter(Epreuve.id.in_(ids)).delete(synchronize_session=False)
    for dj in djs:
        db.delete(dj)
    db.flush()

    # 2. Remettre l'état d'avant, avec les mêmes identifiants. Une épreuve d'avant encore
    # présente sans demi-journée (base sans cascade, SQLite) est un reste : on l'efface ;
    # rattachée ailleurs, son identifiant a été réutilisé et la restauration est impossible.
    ids_avant = [r["id"] for r in avant["epreuves"]]
    if ids_avant:
        dj_existantes = {d.id for d in db.query(DemiJournee.id).all()}
        for e in db.query(Epreuve).filter(Epreuve.id.in_(ids_avant)).all():
            if e.demi_journee_id in dj_existantes:
                raise AnnulationImpossible("Des épreuves ont été recréées depuis à la place des anciennes : annulation impossible.")
        db.query(Epreuve).filter(Epreuve.id.in_(ids_avant)).delete(synchronize_session=False)
    if avant["demi_journees"]:
        db.execute(insert(DemiJournee.__table__), [_relire(DemiJournee.__table__, r) for r in avant["demi_journees"]])
    if avant["epreuves"]:
        db.execute(insert(Epreuve.__table__), [_relire(Epreuve.__table__, r) for r in avant["epreuves"]])
    liens_existants = {
        (l.inscription_id, l.epreuve_id) for l in db.query(InscriptionEpreuve).filter(
            InscriptionEpreuve.epreuve_id.in_([r["epreuve_id"] for r in avant["liens"]])).all()
    } if avant["liens"] else set()
    a_inserer = [r for r in avant["liens"] if (r["inscription_id"], r["epreuve_id"]) not in liens_existants]
    if a_inserer:
        db.execute(insert(InscriptionEpreuve.__table__),
                   [{k: v for k, v in _relire(InscriptionEpreuve.__table__, r).items() if k != "id"} for r in a_inserer])
    for i in avant["inscriptions"]:
        insc = db.get(Inscription, i["id"])
        if insc:
            insc.statut = i["statut"]
            insc.cancelled_at = datetime.fromisoformat(i["cancelled_at"]) if i["cancelled_at"] else None
    for c in avant["candidats"]:
        cand = db.get(Candidat, c["id"])
        if cand:
            cand.statut = c["statut"]
    for h in avant["historique"]:
        ligne = db.get(PlancheHistorique, h["id"])
        if ligne:
            ligne.epreuve_id = h["epreuve_id"]
    return f"Journée du {jour.strftime('%d/%m/%Y')} remise dans son état d'avant ({len(avant['epreuves'])} épreuve(s))."


# ── CHAMPS : valeurs de champs d'épreuves (et salles par défaut) ─────────────

def valeurs(epreuves: Iterable[Epreuve], champs: Iterable[str]) -> dict:
    champs = list(champs)
    return {str(e.id): {c: getattr(e, c) for c in champs} for e in epreuves}


def defauts(db: Session, planning_id: int) -> list:
    return sorted(
        ({k: v for k, v in _ligne(r).items() if k != "id"}
         for r in db.query(PlanningMatiereSalleDefaut).filter_by(planning_id=planning_id).all()),
        key=lambda r: r["matiere"],
    )


def enregistrer_champs(
    db: Session, request, planning_id: int, libelle: str, avant: dict, apres: dict,
    defauts_avant: Optional[list] = None, defauts_apres: Optional[list] = None,
) -> Optional[Annulation]:
    """avant/apres : {id épreuve: {champ: valeur}} ; seules les épreuves modifiées sont gardées."""
    changes = {i: {"avant": avant[i], "apres": apres[i]} for i in avant if i in apres and avant[i] != apres[i]}
    defauts_changes = defauts_avant is not None and defauts_avant != defauts_apres
    if not changes and not defauts_changes:
        return None
    return _enregistrer(db, request, "CHAMPS", planning_id, libelle, {
        "epreuves": changes,
        "defauts_avant": defauts_avant if defauts_changes else None,
        "defauts_apres": defauts_apres if defauts_changes else None,
    })


def _restaurer_champs(db: Session, planning_id: int, d: dict) -> str:
    remises = ignorees = 0
    eps = {str(e.id): e for e in db.query(Epreuve).filter(Epreuve.id.in_([int(i) for i in d["epreuves"]])).all()} if d["epreuves"] else {}
    for i, v in d["epreuves"].items():
        e = eps.get(i)
        if e is None:
            ignorees += 1
            continue
        touchee = False
        for champ, apres in v["apres"].items():
            if v["avant"][champ] == apres:
                continue
            if getattr(e, champ) == apres:
                setattr(e, champ, v["avant"][champ])
                touchee = True
            else:
                ignorees += 1
        remises += touchee
    message = f"{remises} épreuve(s) remise(s) dans leur état d'avant" if d["epreuves"] else "Rien à remettre sur les épreuves"
    if d.get("defauts_avant") is not None:
        if defauts(db, planning_id) == d["defauts_apres"]:
            db.query(PlanningMatiereSalleDefaut).filter_by(planning_id=planning_id).delete()
            if d["defauts_avant"]:
                db.execute(insert(PlanningMatiereSalleDefaut.__table__),
                           [_relire(PlanningMatiereSalleDefaut.__table__, r) for r in d["defauts_avant"]])
            message += ", salles par défaut rétablies"
        else:
            message += " ; salles par défaut modifiées depuis, laissées telles quelles"
    if ignorees:
        message += f" ; {ignorees} valeur(s) modifiée(s) depuis ou épreuve(s) supprimée(s), laissées telles quelles"
    return message + "."


# ── Liste et annulation ──────────────────────────────────────────────────────

def annulables(db: Session, limite: int = 20) -> list:
    return (
        db.query(Annulation)
        .filter(Annulation.annulee_le.is_(None), Annulation.created_at >= _maintenant() - DUREE)
        .order_by(Annulation.created_at.desc(), Annulation.id.desc())
        .limit(limite).all()
    )


def annuler(db: Session, annulation_id: int) -> str:
    a = db.get(Annulation, annulation_id)
    if a is None:
        raise AnnulationImpossible("Action introuvable.")
    if a.annulee_le is not None:
        raise AnnulationImpossible("Cette action a déjà été annulée.")
    if a.created_at < _maintenant() - DUREE:
        raise AnnulationImpossible("Cette action date de plus de 24 h : elle ne peut plus être annulée.")
    d = json.loads(a.donnees)
    try:
        message = _restaurer_date(db, a.planning_id, d) if a.type == "DATE" else _restaurer_champs(db, a.planning_id, d)
        a.annulee_le = _maintenant()
        db.commit()
    except Exception:
        db.rollback()
        raise
    return message
