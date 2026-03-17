from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.journee_type import JourneeType
from app.models.journee_type_bloc import JourneeTypeBloc
from app.schemas.journee_type import JourneeTypeCreate, JourneeTypeOut
from app.schemas.journee_type_bloc import JourneeTypeBlocCreate, JourneeTypeBlocOut, JourneeTypeBlocUpdate

router = APIRouter(
    prefix="/admin/journee-types",
    tags=["journee-types"],
    dependencies=[Depends(require_admin)],
)


# ── JourneeType CRUD ──────────────────────────────────────────────────────────

@router.get("/", response_model=List[JourneeTypeOut])
def list_journee_types(db: Session = Depends(get_db)):
    return db.query(JourneeType).order_by(JourneeType.id).all()


@router.post("/", response_model=JourneeTypeOut, status_code=201)
def create_journee_type(body: JourneeTypeCreate, db: Session = Depends(get_db)):
    jt = JourneeType(**body.model_dump())
    db.add(jt)
    db.commit()
    db.refresh(jt)
    return jt


@router.get("/{jt_id}", response_model=JourneeTypeOut)
def get_journee_type(jt_id: int, db: Session = Depends(get_db)):
    jt = db.get(JourneeType, jt_id)
    if not jt:
        raise HTTPException(status_code=404, detail="JourneeType not found")
    return jt


@router.delete("/{jt_id}", status_code=204)
def delete_journee_type(jt_id: int, db: Session = Depends(get_db)):
    jt = db.get(JourneeType, jt_id)
    if not jt:
        raise HTTPException(status_code=404, detail="JourneeType not found")
    db.delete(jt)
    db.commit()


# ── Blocs ─────────────────────────────────────────────────────────────────────

@router.get("/{jt_id}/blocs", response_model=List[JourneeTypeBlocOut])
def list_blocs(jt_id: int, db: Session = Depends(get_db)):
    jt = db.get(JourneeType, jt_id)
    if not jt:
        raise HTTPException(status_code=404, detail="JourneeType not found")
    return sorted(jt.blocs, key=lambda b: b.ordre)


@router.post("/{jt_id}/blocs", response_model=JourneeTypeBlocOut, status_code=201)
def add_bloc(jt_id: int, body: JourneeTypeBlocCreate, db: Session = Depends(get_db)):
    jt = db.get(JourneeType, jt_id)
    if not jt:
        raise HTTPException(status_code=404, detail="JourneeType not found")

    data = body.model_dump()
    matieres = data.pop("matieres", None) or []

    bloc = JourneeTypeBloc(journee_type_id=jt_id, **data)
    bloc.matieres = matieres
    db.add(bloc)
    db.commit()
    db.refresh(bloc)
    return bloc


@router.put("/blocs/{bloc_id}", response_model=JourneeTypeBlocOut)
def update_bloc(bloc_id: int, body: JourneeTypeBlocUpdate, db: Session = Depends(get_db)):
    bloc = db.get(JourneeTypeBloc, bloc_id)
    if not bloc:
        raise HTTPException(status_code=404, detail="Bloc not found")
    data = body.model_dump()
    matieres = data.pop("matieres", None) or []
    for k, v in data.items():
        setattr(bloc, k, v)
    bloc.matieres = matieres
    db.commit()
    db.refresh(bloc)
    return bloc


@router.delete("/blocs/{bloc_id}", status_code=204)
def delete_bloc(bloc_id: int, db: Session = Depends(get_db)):
    bloc = db.get(JourneeTypeBloc, bloc_id)
    if not bloc:
        raise HTTPException(status_code=404, detail="Bloc not found")
    db.delete(bloc)
    db.commit()
