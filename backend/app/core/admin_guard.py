import os
from fastapi import Header, HTTPException

def require_admin(x_admin_api_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("ADMIN_API_KEY")
    if not expected:
        raise HTTPException(status_code=500, detail="ADMIN_API_KEY not configured")
    if x_admin_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin API key")
