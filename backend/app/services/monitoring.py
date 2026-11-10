"""
Monitoring de l'activité : qui est connecté, qui fait quoi (onglet Monitoring de l'admin).

Le middleware `JournalActiviteMiddleware` enregistre dans `audit_log` :
  - chaque requête d'écriture (POST/PUT/PATCH/DELETE), réussie ou non, connexions comprises ;
  - au plus une « consultation » (GET) toutes les INTERVALLE_CONSULTATION par personne
    identifiée, ce qui suffit pour savoir qui est en ligne et quand la plateforme est utilisée.
Rien n'est enregistré pour /health (ping du cron) ni pour les requêtes anonymes en lecture.
L'écriture se fait hors du traitement de la requête : un échec du journal ne bloque jamais
l'utilisateur.
"""
from __future__ import annotations

import asyncio
import os
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from urllib.parse import unquote

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.auth import ALGORITHM, SECRET_KEY

JOURS_CONSERVATION = 30
INTERVALLE_CONSULTATION = 5 * 60  # secondes entre deux consultations journalisées d'une même personne
CHEMINS_IGNORES = ("/health", "/docs", "/redoc", "/openapi.json", "/favicon.ico")

Acteur = Tuple[str, Optional[int], Optional[str]]  # (type, id, nom)

_derniere_consultation: dict = {}
_verrou = threading.Lock()
_derniere_purge = 0.0


def maintenant_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def signaler_acteur(request: Request, acteur_type: str, acteur_id: int, nom: Optional[str] = None) -> None:
    """À appeler depuis une route de connexion réussie : la requête n'a pas encore de jeton."""
    request.state.acteur = (acteur_type, acteur_id, nom)


def identifier_acteur(request: Request) -> Optional[Acteur]:
    signale = getattr(request.state, "acteur", None)
    if signale:
        return signale
    path = request.url.path
    if path.startswith("/admin"):
        # Identité transmise par le proxy Next.js, crue seulement avec la clé d'API admin
        cle = os.getenv("ADMIN_API_KEY")
        if cle and request.headers.get("x-admin-api-key") == cle:
            brut = request.headers.get("x-admin-id")
            nom = unquote(request.headers.get("x-admin-username") or "") or None
            return ("admin", int(brut) if brut and brut.isdigit() else None, nom)
        return None
    auth = request.headers.get("authorization") or ""
    if auth.startswith("Bearer "):
        try:
            payload = jwt.decode(auth.removeprefix("Bearer "), SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("type") in ("candidat", "examinateur", "surveillant"):
                return (payload["type"], int(payload["sub"]), None)
        except (JWTError, KeyError, ValueError):
            return None
    return None


def _a_journaliser(methode: str, acteur: Optional[Acteur]) -> bool:
    if methode in ("POST", "PUT", "PATCH", "DELETE"):
        return True
    if methode != "GET" or acteur is None:
        return False
    cle = (acteur[0], acteur[1], acteur[2])
    t = time.monotonic()
    with _verrou:
        if t - _derniere_consultation.get(cle, -1e9) < INTERVALLE_CONSULTATION:
            return False
        _derniere_consultation[cle] = t
    return True


def _enregistrer(ligne: dict) -> None:
    from app.db.session import SessionLocal
    from app.models.audit_log import AuditLog
    global _derniere_purge
    if SessionLocal is None:
        return
    db = SessionLocal()
    try:
        db.add(AuditLog(**ligne))
        # Purge au plus une fois par jour
        if time.monotonic() - _derniere_purge > 24 * 3600:
            _derniere_purge = time.monotonic()
            db.query(AuditLog).filter(
                AuditLog.created_at < maintenant_utc() - timedelta(days=JOURS_CONSERVATION)
            ).delete(synchronize_session=False)
        db.commit()
    except Exception as e:  # le journal ne doit jamais casser une requête
        db.rollback()
        print(f"[monitoring] journal non enregistré : {e}", flush=True)
    finally:
        db.close()


class JournalActiviteMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or path == "/" or path.startswith(CHEMINS_IGNORES):
            return await call_next(request)
        debut = time.monotonic()
        response = await call_next(request)
        try:
            acteur = identifier_acteur(request)
            if _a_journaliser(request.method, acteur):
                route = request.scope.get("route")
                ligne = dict(
                    created_at=maintenant_utc(),
                    acteur_type=acteur[0] if acteur else "anonyme",
                    acteur_id=acteur[1] if acteur else None,
                    acteur_nom=(acteur[2] or None)[:200] if acteur and acteur[2] else None,
                    methode=request.method,
                    route=getattr(route, "path", None),
                    chemin=path[:500],
                    statut_http=response.status_code,
                    duree_ms=int((time.monotonic() - debut) * 1000),
                )
                asyncio.get_running_loop().run_in_executor(None, _enregistrer, ligne)
        except Exception as e:
            print(f"[monitoring] {e}", flush=True)
        return response


# ── Libellés lisibles des actions ─────────────────────────────────────────────

_LIBELLES = {
    "POST /admin/auth/login": "Connexion",
    "POST /portal/login": "Connexion",
    "POST /examinateur/login": "Connexion",
    "POST /surveillant/login": "Connexion",
    "POST /admin/auth/change-password": "Changement de mot de passe",
    "POST /portal/me/change-password": "Changement de mot de passe",
    "POST /examinateur/me/change-password": "Changement de mot de passe",
    "POST /surveillant/me/change-password": "Changement de mot de passe",
    "POST /admin/auth/forgot-password": "Mot de passe oublié",
    "POST /portal/forgot-password": "Mot de passe oublié",
    "POST /examinateur/forgot-password": "Mot de passe oublié",
    "POST /surveillant/forgot-password": "Mot de passe oublié",
    "POST /admin/auth/reset-password": "Réinitialisation du mot de passe",
    "POST /portal/reset-password": "Réinitialisation du mot de passe",
    "POST /examinateur/reset-password": "Réinitialisation du mot de passe",
    "POST /surveillant/reset-password": "Réinitialisation du mot de passe",
    # Planning
    "POST /admin/plannings/": "Création d'un planning",
    "PUT /admin/plannings/{planning_id}": "Modification d'un planning",
    "DELETE /admin/plannings/{planning_id}": "Suppression d'un planning",
    "POST /admin/plannings/{planning_id}/apply-journee-type": "Application d'une journée type",
    "DELETE /admin/plannings/{planning_id}/day": "Suppression d'une journée du planning",
    "POST /admin/plannings/{planning_id}/statut": "Changement de statut du planning",
    "PUT /admin/plannings/{planning_id}/salle-defaults": "Salles par défaut",
    "POST /admin/plannings/{planning_id}/salle-defaults/apply": "Application des salles par défaut",
    "PATCH /admin/plannings/{planning_id}/epreuves/{epreuve_id}": "Modification d'une épreuve",
    "POST /admin/demi-journees/{dj_id}/generate": "Génération d'une demi-journée",
    "DELETE /admin/demi-journees/{dj_id}": "Suppression d'une demi-journée",
    "POST /admin/epreuves/dupliquer-triplet": "Ajout d'un triplet",
    "POST /admin/epreuves/supprimer-triplet": "Suppression d'un triplet",
    "POST /admin/epreuves/supprimer-creneau": "Suppression d'un créneau",
    "PUT /admin/epreuves/{epreuve_id}": "Modification d'une épreuve",
    "DELETE /admin/epreuves/{epreuve_id}": "Suppression d'une épreuve",
    # Journées types
    "POST /admin/journee-types/": "Création d'une journée type",
    "PUT /admin/journee-types/{jt_id}": "Modification d'une journée type",
    "DELETE /admin/journee-types/{jt_id}": "Suppression d'une journée type",
    "POST /admin/journee-types/{jt_id}/blocs": "Ajout d'un bloc de journée type",
    "PUT /admin/journee-types/blocs/{bloc_id}": "Modification d'un bloc de journée type",
    "DELETE /admin/journee-types/blocs/{bloc_id}": "Suppression d'un bloc de journée type",
    # Candidats et inscriptions
    "POST /admin/candidats/": "Création d'un candidat",
    "PUT /admin/candidats/{candidat_id}": "Modification d'un candidat",
    "DELETE /admin/candidats/{candidat_id}": "Suppression d'un candidat",
    "DELETE /admin/candidats/planning/{planning_id}/all": "Suppression de tous les candidats",
    "POST /admin/gestion-candidats/candidat/{candidat_id}/inscrire": "Inscription d'un candidat (admin)",
    "POST /admin/gestion-candidats/candidat/{candidat_id}/inscrire-direct": "Inscription d'un candidat (admin)",
    "POST /admin/gestion-candidats/candidat/{candidat_id}/desinscrire": "Désinscription d'un candidat (admin)",
    "POST /admin/gestion-candidats/candidat/{candidat_id}/desinscrire-prereserver": "Désinscription + préréservation (admin)",
    "POST /admin/gestion-candidats/candidat/{candidat_id}/casser-triplet": "Triplet cassé (admin)",
    "POST /admin/gestion-candidats/candidat/{candidat_id}/epreuve/{epreuve_id}/assigner": "Épreuve assignée (admin)",
    "POST /admin/gestion-candidats/candidat/{candidat_id}/epreuve/{epreuve_id}/retirer": "Épreuve retirée (admin)",
    "POST /admin/gestion-candidats/candidat/{candidat_id}/epreuve/{epreuve_id}/marquer-absent": "Candidat marqué absent",
    "DELETE /admin/gestion-candidats/candidat/{candidat_id}/epreuve/{epreuve_id}/marquer-absent": "Absence annulée",
    "PUT /admin/gestion-candidats/candidat/{candidat_id}/commentaire": "Commentaire candidat",
    "POST /admin/gestion-candidats/{planning_id}/triplets/prereserver": "Préréservation de triplets",
    "POST /admin/gestion-candidats/{planning_id}/triplets/liberer": "Libération de triplets",
    "POST /admin/gestion-candidats/{planning_id}/liste-attente/prevenir": "Liste d'attente prévenue",
    "POST /portal/inscription": "Inscription (candidat)",
    "POST /portal/me/inscriptions": "Inscription (candidat)",
    "DELETE /portal/inscription/{epreuve_id}": "Désinscription (candidat)",
    "DELETE /portal/me/inscriptions/{inscription_id}": "Désinscription (candidat)",
    "PUT /portal/me/liste-attente": "Liste d'attente (candidat)",
    # Imports
    "POST /admin/excel/plannings/{planning_id}/candidats/import": "Import de candidats",
    "POST /admin/excel/plannings/{planning_id}/candidats/import-complet": "Import de candidats",
    "POST /admin/excel/plannings/{planning_id}/examinateurs/import": "Import d'examinateurs",
    "POST /admin/excel/plannings/{planning_id}/import": "Import Excel du planning",
    "POST /admin/excel/etablissements/import": "Import d'établissements",
    # Examinateurs, surveillants, notes
    "POST /admin/examinateurs/": "Création d'un examinateur",
    "PUT /admin/examinateurs/{examinateur_id}": "Modification d'un examinateur",
    "DELETE /admin/examinateurs/{examinateur_id}": "Suppression d'un examinateur",
    "POST /admin/examinateurs/assign-bulk": "Affectation d'examinateurs",
    "POST /admin/examinateurs/epreuves/{epreuve_id}/assigner": "Affectation d'un examinateur",
    "POST /admin/surveillants/": "Création d'un surveillant",
    "PUT /admin/surveillants/{surveillant_id}": "Modification d'un surveillant",
    "DELETE /admin/surveillants/{surveillant_id}": "Suppression d'un surveillant",
    "POST /admin/surveillants/{surveillant_id}/envoyer-identifiants": "Envoi d'identifiants à un surveillant",
    "POST /surveillant/me/epreuves/{epreuve_id}/marquer-absent": "Candidat marqué absent (surveillant)",
    "DELETE /surveillant/me/epreuves/{epreuve_id}/marquer-absent": "Absence annulée (surveillant)",
    "POST /examinateur/me/epreuves/{epreuve_id}/noter": "Saisie d'une note (examinateur)",
    "POST /admin/notes/saisir": "Saisie d'une note",
    "POST /admin/notes/publier-tout": "Publication des notes",
    "POST /admin/notes/publier-bulk": "Publication des notes",
    "POST /admin/notes/{note_id}/publier": "Publication d'une note",
    "POST /admin/notes/{note_id}/valider": "Validation d'une note",
    "PATCH /admin/notes/{note_id}/harmoniser": "Harmonisation d'une note",
    # Comptes et paramétrages
    "POST /admin/comptes/": "Création d'un compte admin",
    "PATCH /admin/comptes/{admin_id}": "Modification d'un compte admin",
    "DELETE /admin/comptes/{admin_id}": "Suppression d'un compte admin",
    "PUT /admin/parametrages/message-types/{code}": "Modification d'un message-type",
    "POST /admin/planches/upload": "Ajout de planches",
    "POST /admin/planches/epreuves/{epreuve_id}/assigner": "Planche assignée",
}

_GENERIQUES = [
    (re.compile(r"^/admin/parametrages"), "Paramétrages"),
    (re.compile(r"^/admin/planches"), "Planches"),
    (re.compile(r"^/admin/examinateurs"), "Examinateurs"),
    (re.compile(r"^/admin/surveillants"), "Surveillants"),
    (re.compile(r"^/admin/epreuves"), "Épreuves"),
    (re.compile(r"^/admin/notes"), "Notes"),
]
_VERBES = {"POST": "action", "PUT": "modification", "PATCH": "modification", "DELETE": "suppression"}


def libelle_action(methode: str, route: Optional[str], chemin: str) -> str:
    if methode == "GET":
        return "Consultation"
    if route and f"{methode} {route}" in _LIBELLES:
        return _LIBELLES[f"{methode} {route}"]
    for motif, domaine in _GENERIQUES:
        if motif.search(route or chemin):
            return f"{domaine} : {_VERBES.get(methode, methode.lower())}"
    return f"{methode} {route or chemin}"
