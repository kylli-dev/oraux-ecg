"""
Limitation des essais sur les connexions et les demandes de réinitialisation de mot de
passe, contre les attaques qui testent des mots de passe en boucle.

Chaque essai compte pour une ou plusieurs clés (l'identifiant visé, l'adresse IP) ; au-delà
du maximum sur la fenêtre glissante, la route répond 429 jusqu'à ce que les plus anciens
essais sortent de la fenêtre. Une connexion réussie efface les échecs de l'identifiant.

Compteurs en mémoire : valables pour un seul processus (le service Render en a un) et remis
à zéro au redémarrage, ce qui suffit à rendre une attaque en boucle impraticable.
"""
import threading
import time
from collections import defaultdict, deque
from typing import Dict, Iterable, Tuple

from fastapi import HTTPException, Request

FENETRE_S = 15 * 60
MAX_PAR_IDENTIFIANT = 5   # échecs de connexion (ou demandes) pour un même compte
MAX_PAR_IP = 50           # pour une même adresse IP, tous comptes confondus (assez large
                          # pour un lycée dont les élèves partagent une adresse)

_essais: Dict[str, deque] = defaultdict(deque)
_verrou = threading.Lock()


def ip_de(request: Request) -> str:
    """Adresse du client. Derrière le proxy de Render, c'est la dernière de X-Forwarded-For
    (celle que Render a vue) : les précédentes peuvent être inventées par le client."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip()
    return request.client.host if request.client else "inconnue"


def _purger(cle: str, maintenant: float) -> deque:
    q = _essais[cle]
    while q and q[0] <= maintenant - FENETRE_S:
        q.popleft()
    return q


def _bloque(q: deque, maintenant: float) -> HTTPException:
    attente = int(q[0] + FENETRE_S - maintenant) + 1
    minutes = max(1, (attente + 59) // 60)
    return HTTPException(
        status_code=429,
        detail=f"Trop de tentatives. Réessayez dans {minutes} minute{'s' if minutes > 1 else ''}.",
    )


def verifier(cles: Iterable[Tuple[str, int]]) -> None:
    """Refuse (429) si l'une des clés a atteint son maximum. cles : (clé, maximum)."""
    maintenant = time.monotonic()
    with _verrou:
        for cle, maximum in cles:
            q = _purger(cle, maintenant)
            if len(q) >= maximum:
                raise _bloque(q, maintenant)


def echec(cles, message: str) -> None:
    """Connexion refusée : compte l'essai puis lève l'erreur à afficher. Annonce les essais
    restants avant le blocage ; le dernier essai raté bloque aussitôt (429). Même réponse
    qu'un compte existe ou non : le décompte ne révèle rien sur les comptes."""
    cles = list(cles)
    maintenant = time.monotonic()
    with _verrou:
        restants = None
        for cle, maximum in cles:
            q = _purger(cle, maintenant)
            q.append(maintenant)
            r = maximum - len(q)
            if r <= 0:
                raise _bloque(q, maintenant)
            restants = r if restants is None else min(restants, r)
    if restants is not None and restants <= 3:
        message += (f" Il vous reste {restants} tentative{'s' if restants > 1 else ''}"
                    f" avant un blocage de {FENETRE_S // 60} minutes.")
    raise HTTPException(status_code=401, detail=message)


def noter(cles: Iterable[Tuple[str, int]]) -> None:
    """Compte un essai (échec de connexion, ou demande de réinitialisation)."""
    maintenant = time.monotonic()
    with _verrou:
        for cle, _ in cles:
            _purger(cle, maintenant).append(maintenant)


def effacer(cle: str) -> None:
    with _verrou:
        _essais.pop(cle, None)


def cles_connexion(espace: str, identifiant: str, request: Request, par_ip: bool = True):
    """Clés d'une tentative de connexion : le compte visé et, sauf exception, l'adresse IP.
    par_ip=False pour l'admin : la connexion passe par le serveur Vercel, dont l'adresse
    est la même pour tous les admins."""
    cles = [(f"{espace}:id:{identifiant.strip().lower()}", MAX_PAR_IDENTIFIANT)]
    if par_ip:
        cles.append((f"{espace}:ip:{ip_de(request)}", MAX_PAR_IP))
    return cles
