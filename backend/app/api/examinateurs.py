from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.admin_guard import require_admin
from app.db.deps import get_db
from app.models.examinateur import Examinateur
from app.models.epreuve import Epreuve
from app.schemas.examinateur import ExaminateurCreate, ExaminateurOut, ExaminateurUpdate, AssignerExaminateurIn

router = APIRouter(
    prefix="/admin/examinateurs",
    tags=["examinateurs"],
    dependencies=[Depends(require_admin)],
)

@router.get("/", response_model=List[ExaminateurOut])
def list_examinateurs(planning_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Examinateur)
    if planning_id:
        q = q.filter_by(planning_id=planning_id)
    return q.order_by(Examinateur.nom, Examinateur.prenom).all()

@router.post("/", response_model=ExaminateurOut, status_code=201)
def create_examinateur(body: ExaminateurCreate, db: Session = Depends(get_db)):
    data = body.model_dump()
    matieres = data.pop("matieres")
    ex = Examinateur(**data)
    ex.matieres = matieres
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex

@router.get("/{examinateur_id}", response_model=ExaminateurOut)
def get_examinateur(examinateur_id: int, db: Session = Depends(get_db)):
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    return ex

@router.put("/{examinateur_id}", response_model=ExaminateurOut)
def update_examinateur(examinateur_id: int, body: ExaminateurUpdate, db: Session = Depends(get_db)):
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    data = body.model_dump(exclude_none=True)
    if "matieres" in data:
        ex.matieres = data.pop("matieres")
    for field, value in data.items():
        setattr(ex, field, value)
    db.commit()
    db.refresh(ex)
    return ex

@router.delete("/{examinateur_id}", status_code=204)
def delete_examinateur(examinateur_id: int, db: Session = Depends(get_db)):
    ex = db.get(Examinateur, examinateur_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Examinateur not found")
    db.query(Epreuve).filter_by(examinateur_id=examinateur_id).update({"examinateur_id": None})
    db.delete(ex)
    db.commit()

@router.post("/epreuves/{epreuve_id}/assigner")
def assigner_examinateur(epreuve_id: int, body: AssignerExaminateurIn, db: Session = Depends(get_db)):
    e = db.get(Epreuve, epreuve_id)
    if not e:
        raise HTTPException(status_code=404, detail="Epreuve not found")
    if body.examinateur_id is None:
        e.examinateur_id = None
    else:
        ex = db.get(Examinateur, body.examinateur_id)
        if not ex:
            raise HTTPException(status_code=404, detail="Examinateur not found")
        e.examinateur_id = body.examinateur_id
    db.commit()
    return {"epreuve_id": epreuve_id, "examinateur_id": e.examinateur_id}
