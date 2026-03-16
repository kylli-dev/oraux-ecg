"""
Utilitaires d'authentification : hachage de mot de passe (bcrypt) et tokens JWT.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 heures
RESET_TOKEN_EXPIRE_MINUTES = 30


# ── Mot de passe ────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


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


# ── Token de réinitialisation ────────────────────────────────────────────────

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def reset_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
