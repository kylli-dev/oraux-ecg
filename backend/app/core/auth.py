"""
Utilitaires d'authentification : hachage de mot de passe (bcrypt) et tokens JWT.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from jwt import PyJWTError as JWTError

# Clé de signature des jetons candidat, examinateur et surveillant. Sans elle, n'importe qui
# pourrait fabriquer un jeton valide : en production (base autre que SQLite), le serveur
# refuse de démarrer si elle manque ou garde l'ancienne valeur d'exemple.
_CLE_EXEMPLE = "change-me-in-production"
SECRET_KEY = os.getenv("SECRET_KEY") or ""
_base = os.getenv("DATABASE_URL") or ""
if not SECRET_KEY or SECRET_KEY == _CLE_EXEMPLE:
    if _base and not _base.startswith("sqlite"):
        raise RuntimeError("SECRET_KEY doit être défini (valeur longue et aléatoire) en production.")
    SECRET_KEY = _CLE_EXEMPLE  # développement local uniquement
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 heures
RESET_TOKEN_EXPIRE_MINUTES = 30


# ── Mot de passe ────────────────────────────────────────────────────────────

def hash_password(plain: str, rounds: int = 12) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT ─────────────────────────────────────────────────────────────────────

def create_access_token(candidat_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(candidat_id), "exp": expire, "type": "candidat"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int:
    """Retourne candidat_id ou lève JWTError."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "candidat":
        raise JWTError("Wrong token type")
    return int(payload["sub"])


# ── JWT Examinateur ──────────────────────────────────────────────────────────

def create_examinateur_token(examinateur_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(examinateur_id), "exp": expire, "type": "examinateur"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_examinateur_token(token: str) -> int:
    """Retourne examinateur_id ou lève JWTError."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "examinateur":
        raise JWTError("Wrong token type")
    return int(payload["sub"])


# ── JWT Surveillant ─────────────────────────────────────────────────────────

def create_surveillant_token(surveillant_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(surveillant_id), "exp": expire, "type": "surveillant"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_surveillant_token(token: str) -> int:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "surveillant":
        raise JWTError("Wrong token type")
    return int(payload["sub"])


# ── Token de réinitialisation ────────────────────────────────────────────────

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def reset_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
