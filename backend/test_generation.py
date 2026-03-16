"""
Script de test du generateur de planning.
Usage: python test_generation.py
"""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
KEY = "change-me-123"


def req(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "X-Admin-Api-Key": KEY,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())


def section(title):
    print(f"\n{'=' * 50}")
    print(f"  {title}")
    print('=' * 50)


# ── 1. Creer un planning ──────────────────────────────
section("1. Creer un planning")
planning = req("POST", "/admin/plannings/", {
    "nom": "Oraux ECG 2026",
    "date_debut": "2026-06-01",
    "date_fin": "2026-06-30",
    "date_ouverture_inscriptions": "2026-05-01T09:00:00",
    "date_fermeture_inscriptions": "2026-05-31T18:00:00",
    "statut": "BROUILLON",
})
print(json.dumps(planning, indent=2))
assert "id" in planning, f"ERREUR: {planning}"
planning_id = planning["id"]
print(f">>> Planning ID: {planning_id}")

# ── 2. Creer un gabarit de journee type ──────────────
section("2. Creer un gabarit de journee type")
jt = req("POST", "/admin/journee-types/", {
    "nom": "Journee standard ECG",
    "duree_defaut_minutes": 30,
    "pause_defaut_minutes": 5,
    "statut_initial": "LIBRE",
})
print(json.dumps(jt, indent=2))
assert "id" in jt, f"ERREUR: {jt}"
jt_id = jt["id"]
print(f">>> JourneeType ID: {jt_id}")

# ── 3. Ajouter un bloc PAUSE ──────────────────────────
section("3. Bloc PAUSE (12h00-13h30)")
bloc_pause = req("POST", f"/admin/journee-types/{jt_id}/blocs", {
    "ordre": 2,
    "type_bloc": "PAUSE",
    "heure_debut": "12:00:00",
    "heure_fin": "13:30:00",
})
print(json.dumps(bloc_pause, indent=2))

# ── 4. Bloc GENERATION matin ──────────────────────────
section("4. Bloc GENERATION matin (08h30-12h00, 30min+5pause)")
bloc_matin = req("POST", f"/admin/journee-types/{jt_id}/blocs", {
    "ordre": 1,
    "type_bloc": "GENERATION",
    "heure_debut": "08:30:00",
    "heure_fin": "12:00:00",
    "matieres": ["Maths", "Français", "Anglais"],
    "duree_minutes": 30,
    "pause_minutes": 5,
})
print(json.dumps(bloc_matin, indent=2))

# ── 5. Bloc GENERATION apres-midi ────────────────────
section("5. Bloc GENERATION apres-midi (13h30-17h30, 25min+5pause)")
bloc_aprem = req("POST", f"/admin/journee-types/{jt_id}/blocs", {
    "ordre": 3,
    "type_bloc": "GENERATION",
    "heure_debut": "13:30:00",
    "heure_fin": "17:30:00",
    "matieres": ["Économie", "Histoire-Geo"],
    "duree_minutes": 25,
    "pause_minutes": 5,
})
print(json.dumps(bloc_aprem, indent=2))

# ── 6. Appliquer le gabarit ───────────────────────────
section("6. apply_journee_type -> 2026-06-15")
result = req("POST", f"/admin/plannings/{planning_id}/apply-journee-type", {
    "journee_type_id": jt_id,
    "date": "2026-06-15",
})
print(json.dumps(result, indent=2))

# ── 7. Vue journee ────────────────────────────────────
section("7. Vue journee 2026-06-15")
day = req("GET", f"/admin/plannings/{planning_id}/day?date=2026-06-15")
print(f"  {len(day['demi_journees'])} demi-journee(s) :")
for dj in day["demi_journees"]:
    print(f"\n  [{dj['type']}] {dj['heure_debut']} - {dj['heure_fin']} -> {len(dj['epreuves'])} epreuve(s)")
    for e in dj["epreuves"]:
        print(f"    {e['heure_debut']} - {e['heure_fin']} | {e['matiere']:15} [{e['statut']}]")

# ── 8. Re-generation manuelle ─────────────────────────
section("8. Re-generation manuelle du MATIN (20 min, 0 pause)")
matins = [dj for dj in day["demi_journees"] if dj["type"] == "MATIN"]
assert matins, "Pas de demi-journee MATIN trouvee"
dj_id = matins[0]["id"]

regen = req("POST", f"/admin/demi-journees/{dj_id}/generate", {
    "matieres": ["Maths", "Physique"],
    "duree_minutes": 20,
    "pause_minutes": 0,
    "statut_initial": "CREE",
})
print(json.dumps(regen, indent=2))

day2 = req("GET", f"/admin/plannings/{planning_id}/day?date=2026-06-15")
print("\n  Resultat apres re-generation :")
for dj in day2["demi_journees"]:
    print(f"\n  [{dj['type']}] {len(dj['epreuves'])} epreuve(s)")
    for e in dj["epreuves"]:
        print(f"    {e['heure_debut']} - {e['heure_fin']} | {e['matiere']:15} [{e['statut']}]")

print("\n\nOK - Tous les tests ont reussi.\n")
