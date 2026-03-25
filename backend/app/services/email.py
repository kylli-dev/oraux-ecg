"""
Service d'envoi d'emails (SMTP).

Configuration via variables d'environnement :
  SMTP_SERVER   — ex: smtp.gmail.com
  SMTP_PORT     — défaut 587 (STARTTLS)
  SMTP_USER     — adresse d'expédition / login SMTP
  SMTP_PASSWORD — mot de passe SMTP
  SMTP_FROM     — adresse d'expédition affichée (défaut = SMTP_USER)
  SITE_URL      — URL publique de la plateforme (pour les liens dans les emails)

Si SMTP_SERVER n'est pas défini, les envois sont ignorés (mode dev).
"""
from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

SMTP_SERVER = os.environ.get("SMTP_SERVER", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)
SITE_URL = os.environ.get("SITE_URL", "https://oraux-tau.vercel.app")


def send_email(to: str, subject: str, body_html: str) -> bool:
    """
    Envoie un email HTML.
    Retourne True si l'envoi a réussi, False sinon (SMTP non configuré ou erreur).
    """
    if not SMTP_SERVER or not SMTP_USER or not SMTP_PASSWORD:
        print(f"[email] SMTP non configuré — email ignoré vers {to} | {subject}", flush=True)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to
        msg.attach(MIMEText(body_html, "html", "utf-8"))
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to], msg.as_string())
        print(f"[email] Envoyé → {to} | {subject}", flush=True)
        return True
    except Exception as exc:
        print(f"[email] Erreur envoi → {to} : {exc}", flush=True)
        return False


def render_and_send(db, to_email: str, code: str, variables: dict) -> bool:
    """
    Récupère le template MessageType identifié par `code`,
    substitue les variables et envoie l'email.
    """
    from app.models.message_type import MessageType
    tpl = db.query(MessageType).filter_by(code=code).first()
    if not tpl or not tpl.sujet or not tpl.corps_html:
        return False
    try:
        subject = tpl.sujet.format(**variables)
        body = tpl.corps_html.format(**variables)
    except KeyError:
        subject = tpl.sujet
        body = tpl.corps_html
    return send_email(to_email, subject, body)


# ── Templates intégrés (fallback si le DB template est vide) ──────────────────

_SURVEILLANT_SUBJECT = "Accès à la plateforme des oraux ECG — vos identifiants"

_SURVEILLANT_BODY = """\
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#C62828">Oraux ECG — Identifiants de connexion</h2>
  <p>Bonjour <strong>{prenom} {nom}</strong>,</p>
  <p>Vous avez été ajouté(e) comme surveillant(e) sur la plateforme des oraux ECG.
     Voici vos identifiants :</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr>
      <td style="padding:6px 16px 6px 0;color:#555;font-weight:bold">Login&nbsp;:</td>
      <td style="padding:6px 0"><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">{login}</code></td>
    </tr>
    <tr>
      <td style="padding:6px 16px 6px 0;color:#555;font-weight:bold">Mot de passe&nbsp;:</td>
      <td style="padding:6px 0"><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">{password}</code></td>
    </tr>
  </table>
  <p>
    <a href="{url}" style="background:#C62828;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
      Accéder à la plateforme
    </a>
  </p>
  <p style="color:#888;font-size:13px;margin-top:24px">
    Nous vous recommandons de modifier votre mot de passe dès la première connexion.<br>
    Si vous avez reçu cet email par erreur, ignorez-le.
  </p>
</div>
"""


def send_credentials_surveillant(
    to_email: str,
    prenom: str,
    nom: str,
    login: str,
    plain_password: str,
    db=None,
) -> bool:
    """Envoie les identifiants à un nouveau surveillant."""
    variables = {
        "prenom": prenom,
        "nom": nom,
        "login": login,
        "password": plain_password,
        "url": SITE_URL,
    }
    # Essaie d'abord le template DB
    if db is not None:
        sent = render_and_send(db, to_email, "SURVEILLANT_IDENTIFIANTS", variables)
        if sent:
            return True
    # Fallback sur le template intégré
    try:
        body = _SURVEILLANT_BODY.format(**variables)
        subject = _SURVEILLANT_SUBJECT
    except KeyError:
        body = _SURVEILLANT_BODY
        subject = _SURVEILLANT_SUBJECT
    return send_email(to_email, subject, body)
