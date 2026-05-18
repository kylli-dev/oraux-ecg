"""
Génère un PDF avec cartouche (en-tête) pour une planche assignée à une épreuve.
Utilise reportlab pour créer le cartouche et pypdf pour le fusionner.
"""
from __future__ import annotations

import io
from datetime import date, time
from typing import Optional

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def _build_cartouche_pdf(
    *,
    candidat_nom: str,
    candidat_prenom: str,
    matiere: str,
    examinateur: str,
    date_epreuve: date,
    heure_preparation: Optional[time],
    heure_passage: time,
    page_width: float,
    page_height: float,
) -> bytes:
    """Crée un PDF d'une page contenant uniquement le cartouche."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_width, page_height))

    # Dimensions du cartouche
    margin = 8 * mm
    box_height = 28 * mm
    box_top = page_height - margin
    box_bottom = box_top - box_height

    # Fond gris très clair
    c.setFillColor(colors.HexColor("#F5F5F5"))
    c.rect(margin, box_bottom, page_width - 2 * margin, box_height, fill=1, stroke=0)

    # Bordure
    c.setStrokeColor(colors.HexColor("#1A237E"))
    c.setLineWidth(1.2)
    c.rect(margin, box_bottom, page_width - 2 * margin, box_height, fill=0, stroke=1)

    # Ligne séparatrice centrale verticale
    mid_x = page_width / 2
    c.setLineWidth(0.5)
    c.line(mid_x, box_bottom + 2 * mm, mid_x, box_top - 2 * mm)

    # ── Colonne gauche ──────────────────────────────────────────────────────────
    label_color = colors.HexColor("#1A237E")
    value_color = colors.black

    def label_value(x: float, y: float, label: str, value: str) -> None:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(label_color)
        c.drawString(x, y, label)
        c.setFont("Helvetica", 9)
        c.setFillColor(value_color)
        c.drawString(x + 22 * mm, y, value)

    row1 = box_bottom + 18 * mm
    row2 = box_bottom + 10 * mm
    row3 = box_bottom + 3 * mm

    left_x = margin + 4 * mm
    right_x = mid_x + 4 * mm

    label_value(left_x, row1, "CANDIDAT :", f"{candidat_nom.upper()} {candidat_prenom}")
    label_value(left_x, row2, "MATIÈRE :", matiere)
    label_value(left_x, row3, "EXAMINATEUR :", examinateur)

    # ── Colonne droite ─────────────────────────────────────────────────────────
    from datetime import date as _date

    JOURS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    MOIS_FR = [
        "", "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ]
    date_str = (
        f"{JOURS_FR[date_epreuve.weekday()]} "
        f"{date_epreuve.day} {MOIS_FR[date_epreuve.month]} {date_epreuve.year}"
    )

    def fmt_time(t: time) -> str:
        return t.strftime("%Hh%M").replace("h00", "h")

    prep_str = fmt_time(heure_preparation) if heure_preparation else "—"
    passage_str = fmt_time(heure_passage)
    horaires_str = f"Prépa : {prep_str}   |   Passage : {passage_str}"

    label_value(right_x, row1, "DATE :", date_str)
    label_value(right_x, row2, "HORAIRES :", horaires_str)

    c.save()
    return buf.getvalue()


def generate_planche_with_cartouche(
    *,
    original_pdf_bytes: bytes,
    candidat_nom: str,
    candidat_prenom: str,
    matiere: str,
    examinateur: str,
    date_epreuve: date,
    heure_preparation: Optional[time],
    heure_passage: time,
) -> bytes:
    """
    Option B : compresse le contenu de la première page vers le bas
    pour libérer de la place en haut, puis y appose le cartouche.
    Le contenu original est réduit proportionnellement — aucune superposition.
    """
    from pypdf.transformations import Transformation

    reader = PdfReader(io.BytesIO(original_pdf_bytes))
    writer = PdfWriter()

    first_page = reader.pages[0]
    page_width  = float(first_page.mediabox.width)
    page_height = float(first_page.mediabox.height)

    # Hauteur réservée au cartouche (margin + boîte)
    cartouche_height_pt = (8 + 28) * mm   # 36 mm → ~102 pt

    # Facteur d'échelle : le contenu occupe (page_height - cartouche_height) / page_height
    scale = (page_height - cartouche_height_pt) / page_height

    # Compression du contenu (depuis le coin bas-gauche, pas de translation horizontale)
    first_page.add_transformation(Transformation(ctm=(scale, 0, 0, scale, 0, 0)))

    # Générer le cartouche sur la même taille de page (se place en haut)
    cartouche_bytes = _build_cartouche_pdf(
        candidat_nom=candidat_nom,
        candidat_prenom=candidat_prenom,
        matiere=matiere,
        examinateur=examinateur,
        date_epreuve=date_epreuve,
        heure_preparation=heure_preparation,
        heure_passage=heure_passage,
        page_width=page_width,
        page_height=page_height,
    )

    cartouche_reader = PdfReader(io.BytesIO(cartouche_bytes))
    first_page.merge_page(cartouche_reader.pages[0])
    writer.add_page(first_page)

    # Pages suivantes sans modification
    for page in reader.pages[1:]:
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
