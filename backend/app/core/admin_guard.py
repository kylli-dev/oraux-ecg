import os
from fastapi import Header, HTTPException

def require_admin(x_admin_api_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("ADMIN_API_KEY")
    if not expected:
        raise HTTPException(status_code=500, detail="ADMIN_API_KEY not configured")
    if x_admin_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin API key")


def require_super_admin(x_admin_role: str | None = Header(default=None)) -> None:
    """
    Le rôle du compte admin connecté est transmis par le proxy Next.js (déduit
    du cookie de session) dans le header X-Admin-Role. Absent ou différent de
    "super_admin" => accès refusé.
    """
    if x_admin_role != "super_admin":
        raise HTTPException(status_code=403, detail="Réservé aux super-administrateurs")
