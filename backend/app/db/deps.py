from typing import Generator
from sqlalchemy.orm import Session
from app.db.session import SessionLocal

def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise RuntimeError("Database not configured (SessionLocal is None)")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
