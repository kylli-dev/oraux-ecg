from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.journee_type import JourneeType
from app.models.journee_type_bloc import JourneeTypeBloc
from app.schemas.journee_type import JourneeTypeCreate, JourneeTypeUpdate, JourneeTypeOut, JourneeTypePreviewOut, BlocParamsOut, PeriodePlanOut
from app.services.generation import build_journee_plan
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


@router.get("/{jt_id}/preview", response_model=JourneeTypePreviewOut)
def preview_journee_type(jt_id: int, db: Session = Depends(get_db)):
    """
    Prévisualise la génération d'un gabarit sans toucher à la base de données.

    Retourne le plan complet : périodes (MATIN/APRES_MIDI) avec leurs blocs
    et les paramètres effectifs résolus (après application des valeurs par défaut).
    Utile pour vérifier un gabarit avant de l'appliquer à un planning.
    """
    jt = db.get(JourneeType, jt_id)
    if not jt:
        raise HTTPException(status_code=404, detail="JourneeType not found")

    plans = build_journee_plan(jt)
    return JourneeTypePreviewOut(
        journee_type_id=jt_id,
        periodes=[
            PeriodePlanOut(
                type_dj=p.type_dj,
                heure_debut=p.heure_debut,
                heure_fin=p.heure_fin,
                blocs=[
                    BlocParamsOut(
                        heure_debut=b.heure_debut,
                        heure_fin=b.heure_fin,
                        matieres=b.matieres,
                        duree_minutes=b.duree_minutes,
                        pause_minutes=b.pause_minutes,
                        preparation_minutes=b.preparation_minutes,
                    )
                    for b in p.blocs
                ],
            )
            for p in plans
        ],
    )


@router.put("/{jt_id}", response_model=JourneeTypeOut)
def update_journee_type(jt_id: int, body: JourneeTypeUpdate, db: Session = Depends(get_db)):
    jt = db.get(JourneeType, jt_id)
    if not jt:
        raise HTTPException(status_code=404, detail="JourneeType not found")
    jt.nom = body.nom
    db.commit()
    db.refresh(jt)
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
    matieres_config = data.pop("matieres_config", None)

    bloc = JourneeTypeBloc(journee_type_id=jt_id, **data)
    # Si matieres_config fourni, stocker les dicts (durées variables) ;
    # sinon stocker les strings.
    bloc.matieres = matieres_config if matieres_config else matieres
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
    matieres_config = data.pop("matieres_config", None)
    custom_matrix = data.pop("custom_matrix", None)
    for k, v in data.items():
        setattr(bloc, k, v)
    bloc.matieres = matieres_config if matieres_config else matieres
    bloc.custom_matrix = custom_matrix  # None = réinitialise à la formule N²
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
