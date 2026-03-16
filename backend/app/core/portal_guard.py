"""
Dependency FastAPI qui vérifie le JWT du portail candidat.
Usage : def route(candidat_id: int = Depends(require_candidat))
"""
from fastapi import Depends, HTTPException, Header
from jose import JWTError

from app.core.auth import decode_access_token


def require_candidat(authorization: str | None = Header(default=None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.removeprefix("Bearer ")
    try:
        return decode_access_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
