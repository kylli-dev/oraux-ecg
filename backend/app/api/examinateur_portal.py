"""
Portail examinateur : accès via code_acces unique, saisie de notes.
"""
from typing import List, Optional
from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.auth import create_examinateur_token, decode_examinateur_token
from app.db.deps import get_db
from app.models.examinateur import Examinateur
from app.models.epreuve import Epreuve
from app.models.demi_journee import DemiJournee
from app.models.candidat import Candidat
from app.models.note import Note
from app.models.salle import Salle
from app.models.planche import Planche

router = APIRouter(prefix="/examinateur", tags=["examinateur-portal"])

_bearer = HTTPBearer()


# ── Guard ─────────────────────────────────────────────────────────────────────

def get_current_examinateur(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
    db: Session = Depends(get_db),
) -> Examinateur:
    try:
        ex_id = decode_examinateur_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    ex = db.get(Examinateur, ex_id)
    if not ex:
        raise HTTPException(status_code=401, detail="Examinateur introuvable")
    return ex


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    code_acces: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ExaminateurMe(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    matieres: List[str]

    class Config:
        from_attributes = True


class EpreuveExaminateur(BaseModel):
    id: int
    date: Date
    matiere: str
    heure_debut: str
    heure_fin: str
    preparation_minutes: Optional[int]
    candidat_id: Optional[int]
    candidat_nom: Optional[str]
    candidat_prenom: Optional[str]
    note_valeur: Optional[float]
    note_statut: Optional[str]
    salle_intitule: Optional[str]
    salle_preparation_intitule: Optional[str]
    planche_nom: Optional[str]
    conflit_etablissement: bool = False
    note_commentaire: Optional[str] = None
    # True si l'examinateur connecté est le 2e examinateur de l'épreuve : il la voit et
    # consulte le sujet, mais la saisie de la note reste réservée à l'examinateur principal.
    est_second_examinateur: bool = False


class NoterIn(BaseModel):
    valeur: float
    commentaire: Optional[str] = None
    valider: bool = False   # True = passe en VALIDE + copie vers note_harmonisee


class NoterOut(BaseModel):
    note_id: int
    valeur: float
    statut: str
    commentaire: Optional[str] = None


class CodePerduIn(BaseModel):
    email: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/code-perdu")
def code_perdu(body: CodePerduIn, db: Session = Depends(get_db)):
    """Envoie le code d'accès par email si l'adresse est connue (réponse neutre)."""
    ex = db.query(Examinateur).filter(
        Examinateur.email == body.email.strip().lower()
    ).first()
    if ex:
        pass  # TODO: envoyer email avec ex.code_acces
    return {"sent": True}


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    from sqlalchemy import func as _func
    ex = db.query(Examinateur).filter(
        _func.upper(Examinateur.code_acces) == body.code_acces.strip().upper()
    ).first()
    if not ex:
        raise HTTPException(status_code=401, detail="Code d'accès invalide")
    token = create_examinateur_token(ex.id)
    return LoginOut(access_token=token)


@router.get("/me", response_model=ExaminateurMe)
def me(ex: Examinateur = Depends(get_current_examinateur)):
    return ExaminateurMe(
        id=ex.id,
        nom=ex.nom,
        prenom=ex.prenom,
        email=ex.email,
        matieres=ex.matieres,
    )


@router.get("/me/epreuves", response_model=List[EpreuveExaminateur])
def mes_epreuves(
    ex: Examinateur = Depends(get_current_examinateur),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Epreuve, DemiJournee)
        .join(DemiJournee, Epreuve.demi_journee_id == DemiJournee.id)
        .filter(or_(Epreuve.examinateur_id == ex.id, Epreuve.examinateur2_id == ex.id))
        # Une épreuve n'apparaît dans l'espace examinateur (liste, exports PDF/Excel) qu'une
        # fois qu'un candidat y est affecté — les créneaux encore vides restent masqués.
        .filter(Epreuve.candidat_id.isnot(None))
        .order_by(DemiJournee.date, Epreuve.heure_debut)
        .all()
    )

    result = []
    for epreuve, dj in rows:
        candidat = db.get(Candidat, epreuve.candidat_id) if epreuve.candidat_id else None
        note = None
        if candidat:
            note = (
                db.query(Note)
                .filter_by(candidat_id=candidat.id, matiere=epreuve.matiere)
                .first()
            )
        salle = db.get(Salle, epreuve.salle_id) if epreuve.salle_id else None
        salle_prep = db.get(Salle, epreuve.salle_preparation_id) if epreuve.salle_preparation_id else None
        planche = db.get(Planche, epreuve.planche_id) if epreuve.planche_id else None
        conflit = bool(
            candidat and ex.code_uai and candidat.code_uai
            and ex.code_uai.strip().upper() == candidat.code_uai.strip().upper()
        )
        result.append(EpreuveExaminateur(
            id=epreuve.id,
            date=dj.date,
            matiere=epreuve.matiere,
            heure_debut=str(epreuve.heure_debut)[:5],
            heure_fin=str(epreuve.heure_fin)[:5],
            preparation_minutes=epreuve.preparation_minutes,
            candidat_id=candidat.id if candidat else None,
            candidat_nom=candidat.nom if candidat else None,
            candidat_prenom=candidat.prenom if candidat else None,
            note_valeur=note.valeur if note else None,
            note_statut=note.statut if note else None,
            salle_intitule=salle.intitule if salle else None,
            salle_preparation_intitule=salle_prep.intitule if salle_prep else None,
            planche_nom=planche.nom if planche else None,
            conflit_etablissement=conflit,
            note_commentaire=note.commentaire if note else None,
            est_second_examinateur=epreuve.examinateur_id != ex.id,
        ))
    return result


@router.get("/me/epreuves/{epreuve_id}/planche")
def voir_planche(
    epreuve_id: int,
    ex: Examinateur = Depends(get_current_examinateur),
    db: Session = Depends(get_db),
):
    """Retourne le PDF de la planche assignée à une épreuve de l'examinateur."""
    import io
    from fastapi.responses import StreamingResponse
    epreuve = db.get(Epreuve, epreuve_id)
    if not epreuve or (epreuve.examinateur_id != ex.id and epreuve.examinateur2_id != ex.id):
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if not epreuve.candidat_id:
        # Cohérent avec mes_epreuves : une épreuve sans candidat n'est pas visible
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if not epreuve.planche_id:
        raise HTTPException(status_code=404, detail="Aucun sujet assigné à cette épreuve")
    planche = db.get(Planche, epreuve.planche_id)
    if not planche or not planche.fichier_data:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return StreamingResponse(
        io.BytesIO(planche.fichier_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{planche.nom}.pdf"'},
    )


_JOURS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
_MOIS_FR = ["", "janvier", "février", "mars", "avril", "mai", "juin",
            "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def _planning_examinateur(ex: Examinateur, db: Session, date: Optional[Date]) -> list:
    """
    Lignes du planning de l'examinateur (communes aux exports Excel et PDF), triées par
    date puis heure — filtrées sur une journée si `date` est fourni (filtre de la page).
    """
    lignes = []
    for ep in mes_epreuves(ex=ex, db=db):
        if date and ep.date != date:
            continue
        heure_prep = ""
        if ep.preparation_minutes:
            h, m = map(int, ep.heure_debut.split(":"))
            prep_min = ((h * 60 + m - ep.preparation_minutes) % 1440 + 1440) % 1440
            heure_prep = f"{prep_min // 60:02d}:{prep_min % 60:02d}"
        lignes.append({
            "ep": ep,
            "date_courte": ep.date.strftime("%d-%m-%Y"),
            "date_longue": f"{_JOURS_FR[ep.date.weekday()]} {ep.date.day} {_MOIS_FR[ep.date.month]} {ep.date.year}",
            "heure_prep": heure_prep,
            "candidat": f"{ep.candidat_nom or ''} {ep.candidat_prenom or ''}".strip() if ep.candidat_id else "",
            "role": "2e examinateur" if ep.est_second_examinateur else "Principal",
        })
    lignes.sort(key=lambda l: (l["ep"].date, l["ep"].heure_debut))
    return lignes


def _nom_fichier_planning(ex: Examinateur, date: Optional[Date], ext: str) -> str:
    suffixe = f"_{date.strftime('%d-%m-%Y')}" if date else ""
    return f"{ex.nom}_{ex.prenom}_planning{suffixe}.{ext}".replace(" ", "_")


@router.get("/me/epreuves/export")
def export_planning(
    date: Optional[Date] = None,
    ex: Examinateur = Depends(get_current_examinateur),
    db: Session = Depends(get_db),
):
    """Export Excel du planning + notes de l'examinateur (une journée si `date` est fourni)."""
    import io as _io
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from fastapi.responses import Response as _Response

    lignes = _planning_examinateur(ex, db, date)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Planning"

    headers = [
        "Date", "Matière", "Heure prépa", "Début passage", "Fin passage", "Candidat",
        "Salle prépa", "Salle", "Sujet", "Rôle", "Note /20", "Statut note", "⚠ Conflit établ.",
    ]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="C62828")
        cell.alignment = Alignment(horizontal="center")
    ws.freeze_panes = "A2"

    for l in lignes:
        ep = l["ep"]
        ws.append([
            l["date_courte"], ep.matiere, l["heure_prep"], ep.heure_debut, ep.heure_fin,
            l["candidat"],
            ep.salle_preparation_intitule or "",
            ep.salle_intitule or "",
            ep.planche_nom or "",
            l["role"],
            ep.note_valeur if ep.note_valeur is not None else "",
            ep.note_statut or "",
            "OUI" if ep.conflit_etablissement else "",
        ])

    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)

    buf = _io.BytesIO()
    wb.save(buf)
    return _Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{_nom_fichier_planning(ex, date, "xlsx")}"'},
    )


@router.get("/me/epreuves/export-pdf")
def export_planning_pdf(
    date: Optional[Date] = None,
    ex: Examinateur = Depends(get_current_examinateur),
    db: Session = Depends(get_db),
):
    """
    Export PDF imprimable du planning de l'examinateur (A4 paysage, un bloc par journée).
    Les notes n'y figurent pas : c'est un document d'organisation, à emporter le jour J —
    elles restent dans l'export Excel.
    """
    import io as _io
    from datetime import datetime as _dt
    from fastapi.responses import Response as _Response
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    lignes = _planning_examinateur(ex, db, date)
    rouge = colors.HexColor("#C62828")

    titre_st = ParagraphStyle("titre", fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=colors.black, spaceAfter=4)
    sous_st = ParagraphStyle("sous", fontName="Helvetica", fontSize=9, leading=12, textColor=colors.HexColor("#333333"))
    jour_st = ParagraphStyle("jour", fontName="Helvetica-Bold", fontSize=11, textColor=rouge, spaceBefore=8, spaceAfter=4)
    cell_st = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=10.5, textColor=colors.black)

    buf = _io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm,
        title=f"Planning — {ex.prenom} {ex.nom}", author="ENSAE — Oraux ECG",
    )

    story = [
        Paragraph(f"Planning des oraux — {ex.prenom} {ex.nom.upper()}", titre_st),
        Paragraph(
            ("Journée du " + lignes[0]["date_longue"] if date and lignes else "Toutes les journées")
            + f" · {len(lignes)} épreuve{'s' if len(lignes) > 1 else ''}"
            + f" · généré le {_dt.now().strftime('%d-%m-%Y à %H:%M')}",
            sous_st,
        ),
        Spacer(1, 6 * mm),
    ]

    if not lignes:
        story.append(Paragraph("Aucune épreuve à afficher.", cell_st))

    entetes = ["Prépa", "Passage", "Matière", "Candidat", "Salle prépa", "Salle", "Sujet", "Rôle"]
    largeurs = [16 * mm, 26 * mm, 26 * mm, 58 * mm, 24 * mm, 22 * mm, 66 * mm, 30 * mm]

    jours: dict = {}
    for l in lignes:
        jours.setdefault(l["ep"].date, []).append(l)

    for _, lignes_jour in jours.items():
        story.append(Paragraph(lignes_jour[0]["date_longue"], jour_st))
        data = [entetes]
        for l in lignes_jour:
            ep = l["ep"]
            data.append([
                l["heure_prep"] or "—",
                f"{ep.heure_debut} – {ep.heure_fin}",
                Paragraph(ep.matiere, cell_st),
                Paragraph(l["candidat"] or "<i>Aucun candidat</i>", cell_st),
                ep.salle_preparation_intitule or "—",
                ep.salle_intitule or "—",
                Paragraph(ep.planche_nom or "<i>Non affecté</i>", cell_st),
                l["role"],
            ])
        t = Table(data, colWidths=largeurs, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), rouge),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 1), (-1, -1), colors.black),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#BDBDBD")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t)

    doc.build(story)
    return _Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_nom_fichier_planning(ex, date, "pdf")}"'},
    )


@router.get("/me/stats")
def mes_stats(
    ex: Examinateur = Depends(get_current_examinateur),
    db: Session = Depends(get_db),
):
    """Stats de notation : mes notes vs toutes les notes pour mes matières."""
    import math

    def _stats(values):
        if not values:
            return {"count": 0, "moyenne": None, "ecart_type": None, "min": None, "max": None}
        n = len(values)
        moy = sum(values) / n
        et = math.sqrt(sum((v - moy) ** 2 for v in values) / n) if n > 1 else 0.0
        return {"count": n, "moyenne": round(moy, 2), "ecart_type": round(et, 2), "min": min(values), "max": max(values)}

    result = {}
    for matiere in ex.matieres:
        # Mes notes
        mes_rows = (
            db.query(Note)
            .join(Epreuve, (Epreuve.candidat_id == Note.candidat_id) & (Epreuve.matiere == Note.matiere))
            .filter(Epreuve.examinateur_id == ex.id, Note.matiere == matiere, Note.valeur.isnot(None))
            .all()
        )
        # Toutes les notes pour cette matière
        toutes_rows = db.query(Note).filter(Note.matiere == matiere, Note.valeur.isnot(None)).all()

        result[matiere] = {
            "mes_notes": _stats([n.valeur for n in mes_rows]),
            "toutes_notes": _stats([n.valeur for n in toutes_rows]),
        }
    return result


@router.post("/me/epreuves/{epreuve_id}/noter", response_model=NoterOut)
def noter(
    epreuve_id: int,
    body: NoterIn,
    ex: Examinateur = Depends(get_current_examinateur),
    db: Session = Depends(get_db),
):
    epreuve = db.get(Epreuve, epreuve_id)
    if not epreuve or epreuve.examinateur_id != ex.id:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if not epreuve.candidat_id:
        raise HTTPException(status_code=400, detail="Aucun candidat assigné à cette épreuve")
    if not (0 <= body.valeur <= 20):
        raise HTTPException(status_code=422, detail="La note doit être entre 0 et 20")

    note = (
        db.query(Note)
        .filter_by(candidat_id=epreuve.candidat_id, matiere=epreuve.matiere)
        .first()
    )
    # Bloquer la modification si note déjà harmonisée ou publiée
    if note and note.statut in ("HARMONISE", "PUBLIE"):
        raise HTTPException(status_code=403, detail="Cette note est verrouillée (harmonisée ou publiée)")

    if note:
        note.valeur = body.valeur
        if body.commentaire is not None:
            note.commentaire = body.commentaire
    else:
        note = Note(
            candidat_id=epreuve.candidat_id,
            matiere=epreuve.matiere,
            valeur=body.valeur,
            statut="BROUILLON",
            commentaire=body.commentaire,
        )
        db.add(note)

    if body.valider:
        note.statut = "VALIDE"
        note.note_harmonisee = body.valeur  # copie automatique vers harmonisée

    db.commit()
    db.refresh(note)
    return NoterOut(note_id=note.id, valeur=note.valeur, statut=note.statut, commentaire=note.commentaire)
