"""
Import / Export Excel pour les plannings, candidats et examinateurs.

Export : toutes les épreuves d'un planning (avec candidat si assigné).
Import : création d'épreuves depuis un fichier Excel.
         Format attendu (ligne 1 = en-têtes ignorées) :
         A: date (YYYY-MM-DD)  B: heure_debut (HH:MM)  C: heure_fin (HH:MM)
         D: matiere            E: statut (optionnel, défaut LIBRE)
"""
import io
import json
import secrets
from datetime import date as date_type, time as time_type

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from sqlalchemy.orm import Session

from app.models.candidat import Candidat
from app.models.demi_journee import DemiJournee
from app.models.epreuve import Epreuve
from app.models.examinateur import Examinateur
from app.models.planning import Planning

RED_HEX = "C62828"
GREY_HEX = "F5F5F5"

ALLOWED_STATUT = {"CREE", "LIBRE", "ATTRIBUEE", "EN_EVALUATION", "FINALISEE", "ANNULEE"}


# ── Export ─────────────────────────────────────────────────────────────────────

def export_planning(db: Session, planning_id: int) -> bytes:
    planning = db.get(Planning, planning_id)
    if not planning:
        raise ValueError("Planning not found")

    wb = openpyxl.Workbook()

    # ── Sheet 1 : Planning info ────────────────────────────────────────────────
    ws_info = wb.active
    ws_info.title = "Planning"
    _header_row(ws_info, ["Champ", "Valeur"])
    for row in [
        ("ID", planning.id),
        ("Nom", planning.nom),
        ("Date début", str(planning.date_debut)),
        ("Date fin", str(planning.date_fin)),
        ("Statut", planning.statut),
        ("Ouverture inscriptions", str(planning.date_ouverture_inscriptions)),
        ("Fermeture inscriptions", str(planning.date_fermeture_inscriptions)),
    ]:
        ws_info.append(row)

    # ── Sheet 2 : Épreuves ────────────────────────────────────────────────────
    ws_ep = wb.create_sheet("Epreuves")
    headers = [
        "Date", "Demi-journée", "Heure début", "Heure fin",
        "Matière", "Statut", "Candidat — Nom", "Candidat — Prénom", "Email",
    ]
    _header_row(ws_ep, headers)

    djs = (
        db.query(DemiJournee)
        .filter_by(planning_id=planning_id)
        .order_by(DemiJournee.date, DemiJournee.heure_debut)
        .all()
    )
    for dj in djs:
        epreuves = (
            db.query(Epreuve)
            .filter_by(demi_journee_id=dj.id)
            .order_by(Epreuve.heure_debut)
            .all()
        )
        for e in epreuves:
            cand = db.get(Candidat, e.candidat_id) if e.candidat_id else None
            ws_ep.append([
                str(dj.date),
                dj.type,
                str(e.heure_debut)[:5],
                str(e.heure_fin)[:5],
                e.matiere,
                e.statut,
                cand.nom if cand else "",
                cand.prenom if cand else "",
                cand.email if cand else "",
            ])

    _autosize(ws_ep)

    # ── Sheet 3 : Candidats ────────────────────────────────────────────────────
    ws_cand = wb.create_sheet("Candidats")
    _header_row(ws_cand, ["ID", "Nom", "Prénom", "Email", "Code accès", "Statut"])
    candidats = db.query(Candidat).filter_by(planning_id=planning_id).all()
    for c in candidats:
        ws_cand.append([c.id, c.nom, c.prenom, c.email, c.code_acces, c.statut])
    _autosize(ws_cand)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Template vierge ────────────────────────────────────────────────────────────

def export_template() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Epreuves"
    _header_row(ws, ["date", "heure_debut", "heure_fin", "matiere", "statut"])

    # Lignes d'exemple
    ws.append(["2026-06-15", "08:30", "09:00", "Maths", "LIBRE"])
    ws.append(["2026-06-15", "09:05", "09:35", "Anglais", "LIBRE"])
    ws.append(["2026-06-15", "13:30", "14:00", "Economie", "LIBRE"])

    _autosize(ws)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Import ─────────────────────────────────────────────────────────────────────

def import_epreuves(db: Session, planning_id: int, file_bytes: bytes) -> dict:
    planning = db.get(Planning, planning_id)
    if not planning:
        raise ValueError("Planning not found")

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    created = 0
    errors: list[str] = []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        try:
            d = _parse_date(row[0])
            hdebut = _parse_time(row[1])
            hfin = _parse_time(row[2])
            matiere = str(row[3]).strip() if row[3] else None
            statut = str(row[4]).strip().upper() if len(row) > 4 and row[4] else "LIBRE"

            if not all([d, hdebut, hfin, matiere]):
                errors.append(f"Ligne {i} : données manquantes")
                continue

            if statut not in ALLOWED_STATUT:
                statut = "LIBRE"

            type_dj = "MATIN" if hdebut.hour < 12 else "APRES_MIDI"

            # Upsert demi-journée
            dj = (
                db.query(DemiJournee)
                .filter_by(planning_id=planning_id, date=d, type=type_dj)
                .first()
            )
            if dj is None:
                dj = DemiJournee(
                    planning_id=planning_id,
                    date=d,
                    type=type_dj,
                    heure_debut=hdebut,
                    heure_fin=hfin,
                )
                db.add(dj)
                db.flush()
            else:
                if hdebut < dj.heure_debut:
                    dj.heure_debut = hdebut
                if hfin > dj.heure_fin:
                    dj.heure_fin = hfin
                db.flush()

            e = Epreuve(
                demi_journee_id=dj.id,
                matiere=matiere,
                heure_debut=hdebut,
                heure_fin=hfin,
                statut=statut,
            )
            db.add(e)
            created += 1

        except Exception as ex:
            errors.append(f"Ligne {i} : {ex}")

    db.commit()
    return {"epreuves_created": created, "errors": errors}


# ── Import Candidats ───────────────────────────────────────────────────────────

def import_candidats(db: Session, planning_id: int, file_bytes: bytes) -> dict:
    """
    Importe des candidats depuis un Excel.
    Colonnes attendues (ligne 1 = en-têtes) :
      A: nom  B: prenom  C: email  D: login (optionnel)
      E: profil (HGG/ESH, optionnel)  F: code_uai (optionnel)
    Retourne la liste des créations avec mot de passe provisoire.
    """
    from app.core.auth import hash_password

    planning = db.get(Planning, planning_id)
    if not planning:
        raise ValueError("Planning not found")

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    created = []
    errors: list[str] = []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        try:
            nom = str(row[0]).strip() if row[0] else None
            prenom = str(row[1]).strip() if row[1] else None
            email = str(row[2]).strip() if row[2] else None
            login = str(row[3]).strip() if len(row) > 3 and row[3] else None
            profil = str(row[4]).strip().upper() if len(row) > 4 and row[4] else None
            code_uai = str(row[5]).strip() if len(row) > 5 and row[5] else None

            if not all([nom, prenom, email]):
                errors.append(f"Ligne {i} : nom, prénom et email obligatoires")
                continue

            if profil and profil not in ("HGG", "ESH"):
                profil = None

            # Générer un mot de passe provisoire
            plain_pwd = secrets.token_urlsafe(8)

            c = Candidat(
                planning_id=planning_id,
                nom=nom,
                prenom=prenom,
                email=email,
                login=login or email,
                password_hash=hash_password(plain_pwd),
                profil=profil,
                code_uai=code_uai,
            )
            db.add(c)
            db.flush()
            created.append({
                "id": c.id,
                "nom": nom,
                "prenom": prenom,
                "email": email,
                "login": c.login,
                "password_provisoire": plain_pwd,
            })
        except Exception as ex:
            errors.append(f"Ligne {i} : {ex}")

    db.commit()
    return {"created": len(created), "candidats": created, "errors": errors}


def export_template_candidats() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Candidats"
    _header_row(ws, ["nom", "prenom", "email", "login (optionnel)", "profil (HGG/ESH)", "code_uai (optionnel)"])
    ws.append(["DUPONT", "Alice", "alice.dupont@exemple.fr", "alice.dupont", "HGG", "0751234A"])
    ws.append(["MARTIN", "Bob", "bob.martin@exemple.fr", "", "ESH", ""])
    _autosize(ws)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Import Examinateurs ────────────────────────────────────────────────────────

def import_examinateurs(db: Session, planning_id: int, file_bytes: bytes) -> dict:
    """
    Importe des examinateurs depuis un Excel.
    Colonnes attendues :
      A: nom  B: prenom  C: email
      D: matieres (séparées par ';')  E: code_uai (optionnel)
    """
    planning = db.get(Planning, planning_id)
    if not planning:
        raise ValueError("Planning not found")

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    created = []
    errors: list[str] = []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        try:
            nom = str(row[0]).strip() if row[0] else None
            prenom = str(row[1]).strip() if row[1] else None
            email = str(row[2]).strip() if row[2] else None
            matieres_raw = str(row[3]).strip() if len(row) > 3 and row[3] else ""
            code_uai = str(row[4]).strip() if len(row) > 4 and row[4] else None

            if not all([nom, prenom, email]):
                errors.append(f"Ligne {i} : nom, prénom et email obligatoires")
                continue

            matieres = [m.strip() for m in matieres_raw.split(";") if m.strip()]

            ex = Examinateur(
                planning_id=planning_id,
                nom=nom,
                prenom=prenom,
                email=email,
                matieres_json=json.dumps(matieres),
                code_uai=code_uai,
            )
            db.add(ex)
            db.flush()
            created.append({
                "id": ex.id,
                "nom": nom,
                "prenom": prenom,
                "email": email,
                "code_acces": ex.code_acces,
                "matieres": matieres,
            })
        except Exception as ex_err:
            errors.append(f"Ligne {i} : {ex_err}")

    db.commit()
    return {"created": len(created), "examinateurs": created, "errors": errors}


def export_template_examinateurs() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Examinateurs"
    _header_row(ws, ["nom", "prenom", "email", "matieres (séparées par ;)", "code_uai (optionnel)"])
    ws.append(["BERNARD", "Claire", "claire.bernard@lycee.fr", "Maths;Physique", "0751234A"])
    ws.append(["LEROY", "Paul", "paul.leroy@lycee.fr", "Anglais", ""])
    _autosize(ws)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Template candidats complet (18 champs) ────────────────────────────────────

CANDIDATS_COMPLET_HEADERS = [
    "CODE_CANDIDAT",
    "NUMERO_INE",
    "CIVILITE",
    "NOM",
    "PRENOM",
    "DATE_NAISSANCE",
    "QUALITE",
    "HANDICAPE",
    "CP",
    "VILLE",
    "LIBELLE_PAYS",
    "TEL_PORTABLE",
    "EMAIL",
    "CLASSE",
    "NUMERO_RNE",
    "ETABLISSEMENT",
    "VILLE_ETABLISSEMENT",
    "DEPARTEMENT_ETABLISSEMENT",
]


def export_template_candidats_complet() -> bytes:
    """Fichier modèle d'import candidats avec les 18 champs du concours."""
    wb = openpyxl.Workbook()

    # ── Feuille 1 : données ───────────────────────────────────────────────────
    ws = wb.active
    ws.title = "Candidats"
    _header_row(ws, CANDIDATS_COMPLET_HEADERS)

    # Ligne d'exemple
    ws.append([
        "15617",                          # CODE_CANDIDAT
        "070164375KA",                    # NUMERO_INE
        "M.",                             # CIVILITE  (M. / Mme.)
        "IKSIL",                          # NOM
        "Raphaël",                        # PRENOM
        "30/03/2005",                     # DATE_NAISSANCE  (DD/MM/YYYY)
        "Non boursier",                   # QUALITE
        "Non",                            # HANDICAPE  (Oui / Non)
        "75015",                          # CP
        "Paris",                          # VILLE
        "France",                         # LIBELLE_PAYS
        "0638348849",                     # TEL_PORTABLE
        "raphaeliksil@gmail.com",         # EMAIL
        "ECG - Maths approfondies et HGG",  # CLASSE
        "0750658H",                       # NUMERO_RNE
        "Lycée Saint-Louis",              # ETABLISSEMENT
        "Paris",                          # VILLE_ETABLISSEMENT
        "75",                             # DEPARTEMENT_ETABLISSEMENT
    ])

    # Validation CIVILITE
    from openpyxl.worksheet.datavalidation import DataValidation
    dv_civilite = DataValidation(type="list", formula1='"M.,Mme."', allow_blank=True)
    ws.add_data_validation(dv_civilite)
    dv_civilite.sqref = "C2:C5000"

    # Validation HANDICAPE
    dv_handicap = DataValidation(type="list", formula1='"Oui,Non"', allow_blank=True)
    ws.add_data_validation(dv_handicap)
    dv_handicap.sqref = "H2:H5000"

    _autosize(ws)

    # ── Feuille 2 : instructions ──────────────────────────────────────────────
    ws2 = wb.create_sheet("Instructions")
    instructions = [
        ("Champ", "Description", "Format", "Obligatoire"),
        ("CODE_CANDIDAT", "Code candidat attribué par le concours", "Texte libre", "Non"),
        ("NUMERO_INE", "Identifiant national élève (11 caractères)", "Alphanumérique", "Non"),
        ("CIVILITE", "Civilité", "M. ou Mme.", "Non"),
        ("NOM", "Nom de famille (majuscules recommandées)", "Texte", "Oui"),
        ("PRENOM", "Prénom", "Texte", "Oui"),
        ("DATE_NAISSANCE", "Date de naissance", "DD/MM/YYYY", "Non"),
        ("QUALITE", "Qualité / statut concours (ex : ADMISSIBLE)", "Texte", "Non"),
        ("HANDICAPE", "Aménagement handicap", "Oui ou Non", "Non"),
        ("CP", "Code postal du domicile", "Texte (5 chiffres)", "Non"),
        ("VILLE", "Ville du domicile", "Texte", "Non"),
        ("LIBELLE_PAYS", "Pays du domicile", "Texte", "Non"),
        ("TEL_PORTABLE", "Numéro de téléphone portable", "Texte", "Non"),
        ("EMAIL", "Adresse e-mail (utilisée comme login)", "Email valide", "Oui"),
        ("CLASSE", "Classe (ex : ECG1, ECG2)", "Texte", "Non"),
        ("NUMERO_RNE", "Numéro RNE / code UAI de l'établissement", "8 caractères", "Non"),
        ("ETABLISSEMENT", "Nom de l'établissement d'origine", "Texte", "Non"),
        ("VILLE_ETABLISSEMENT", "Ville de l'établissement", "Texte", "Non"),
        ("DEPARTEMENT_ETABLISSEMENT", "Département de l'établissement", "Texte", "Non"),
    ]
    for row in instructions:
        ws2.append(row)
    # Mettre en forme l'en-tête
    for cell in ws2[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=RED_HEX)
        cell.alignment = Alignment(horizontal="center")
    _autosize(ws2)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def import_candidats_complet(db: Session, planning_id: int, file_bytes: bytes) -> dict:
    """
    Importe des candidats depuis le template complet (18 colonnes).
    Colonnes lues par en-tête (insensible à la casse).
    """
    from app.core.auth import hash_password

    planning = db.get(Planning, planning_id)
    if not planning:
        raise ValueError("Planning not found")

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    # Lire les en-têtes (ligne 1) pour mapper colonne → index
    headers_row = [str(c.value or "").strip().upper() for c in next(ws.iter_rows(min_row=1, max_row=1))]
    col = {h: i for i, h in enumerate(headers_row)}

    def _get(row, name: str) -> str | None:
        idx = col.get(name)
        if idx is None or idx >= len(row):
            return None
        v = row[idx]
        return str(v).strip() if v is not None else None

    def _bool(val: str | None) -> bool | None:
        if val is None:
            return None
        return val.upper() in ("OUI", "1", "TRUE", "VRAI", "YES")

    created = []
    errors: list[str] = []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        try:
            nom = _get(row, "NOM")
            prenom = _get(row, "PRENOM")
            email = _get(row, "EMAIL")

            if not all([nom, prenom, email]):
                errors.append(f"Ligne {i} : NOM, PRENOM et EMAIL sont obligatoires")
                continue

            plain_pwd = secrets.token_urlsafe(8)
            profil = _get(row, "QUALITE")  # mapping simplifié

            c = Candidat(
                planning_id=planning_id,
                nom=nom,
                prenom=prenom,
                email=email,
                login=email,
                password_hash=hash_password(plain_pwd),
                statut="INSCRIT",
                # Champs import complet
                code_candidat=_get(row, "CODE_CANDIDAT"),
                numero_ine=_get(row, "NUMERO_INE"),
                civilite=_get(row, "CIVILITE"),
                date_naissance=_get(row, "DATE_NAISSANCE"),
                tel_portable=_get(row, "TEL_PORTABLE"),
                qualite=_get(row, "QUALITE"),
                handicape=_bool(_get(row, "HANDICAPE")),
                cp=_get(row, "CP"),
                ville=_get(row, "VILLE"),
                libelle_pays=_get(row, "LIBELLE_PAYS"),
                classe=_get(row, "CLASSE"),
                code_uai=_get(row, "NUMERO_RNE"),
                etablissement=_get(row, "ETABLISSEMENT"),
                ville_etablissement=_get(row, "VILLE_ETABLISSEMENT"),
                departement_etablissement=_get(row, "DEPARTEMENT_ETABLISSEMENT"),
            )
            db.add(c)
            db.flush()
            created.append({
                "id": c.id,
                "nom": nom,
                "prenom": prenom,
                "email": email,
                "login": email,
                "password_provisoire": plain_pwd,
                "code_candidat": c.code_candidat,
            })
        except Exception as ex:
            errors.append(f"Ligne {i} : {ex}")

    db.commit()
    return {"created": len(created), "candidats": created, "errors": errors}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _header_row(ws, headers: list):
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=RED_HEX)
        cell.alignment = Alignment(horizontal="center")


def _autosize(ws):
    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)


def _parse_date(val) -> date_type:
    if isinstance(val, date_type):
        return val
    if hasattr(val, "date"):
        return val.date()
    return date_type.fromisoformat(str(val).strip()[:10])


def _parse_time(val) -> time_type:
    if isinstance(val, time_type):
        return val
    s = str(val).strip()[:5]
    parts = s.split(":")
    return time_type(int(parts[0]), int(parts[1]))
