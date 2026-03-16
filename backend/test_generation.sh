#!/usr/bin/env bash
# Test du générateur de planning
# Usage: bash test_generation.sh

BASE="http://localhost:8000"
KEY="change-me-123"
H='-H "X-Admin-Api-Key: '"$KEY"'"'

echo "============================================"
echo "1. Créer un planning"
echo "============================================"
PLANNING=$(curl -s -X POST "$BASE/admin/plannings/" \
  -H "X-Admin-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Oraux ECG 2026",
    "date_debut": "2026-06-01",
    "date_fin": "2026-06-30",
    "date_ouverture_inscriptions": "2026-05-01T09:00:00",
    "date_fermeture_inscriptions": "2026-05-31T18:00:00",
    "statut": "BROUILLON"
  }')
echo "$PLANNING" | python3 -m json.tool
PLANNING_ID=$(echo "$PLANNING" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ">>> Planning ID: $PLANNING_ID"

echo ""
echo "============================================"
echo "2. Créer un gabarit de journée type"
echo "============================================"
JT=$(curl -s -X POST "$BASE/admin/journee-types/" \
  -H "X-Admin-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Journée standard ECG",
    "duree_defaut_minutes": 30,
    "pause_defaut_minutes": 5,
    "statut_initial": "LIBRE"
  }')
echo "$JT" | python3 -m json.tool
JT_ID=$(echo "$JT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ">>> JourneeType ID: $JT_ID"

echo ""
echo "============================================"
echo "3. Ajouter un bloc PAUSE (12h00-13h30)"
echo "============================================"
curl -s -X POST "$BASE/admin/journee-types/$JT_ID/blocs" \
  -H "X-Admin-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ordre": 2,
    "type_bloc": "PAUSE",
    "heure_debut": "12:00:00",
    "heure_fin": "13:30:00"
  }' | python3 -m json.tool

echo ""
echo "============================================"
echo "4. Ajouter un bloc GENERATION matin (08h30-12h00)"
echo "============================================"
curl -s -X POST "$BASE/admin/journee-types/$JT_ID/blocs" \
  -H "X-Admin-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ordre": 1,
    "type_bloc": "GENERATION",
    "heure_debut": "08:30:00",
    "heure_fin": "12:00:00",
    "matieres": ["Maths", "Français", "Anglais"],
    "duree_minutes": 30,
    "pause_minutes": 5
  }' | python3 -m json.tool

echo ""
echo "============================================"
echo "5. Ajouter un bloc GENERATION après-midi (13h30-17h30)"
echo "============================================"
curl -s -X POST "$BASE/admin/journee-types/$JT_ID/blocs" \
  -H "X-Admin-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ordre": 3,
    "type_bloc": "GENERATION",
    "heure_debut": "13:30:00",
    "heure_fin": "17:30:00",
    "matieres": ["Économie", "Histoire-Géo"],
    "duree_minutes": 25,
    "pause_minutes": 5
  }' | python3 -m json.tool

echo ""
echo "============================================"
echo "6. Appliquer le gabarit au 2026-06-15"
echo "   (crée les demi-journées + génère les épreuves)"
echo "============================================"
curl -s -X POST "$BASE/admin/plannings/$PLANNING_ID/apply-journee-type" \
  -H "X-Admin-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"journee_type_id\": $JT_ID,
    \"date\": \"2026-06-15\"
  }" | python3 -m json.tool

echo ""
echo "============================================"
echo "7. Vue journée du 2026-06-15"
echo "============================================"
curl -s "$BASE/admin/plannings/$PLANNING_ID/day?date=2026-06-15" \
  -H "X-Admin-Api-Key: $KEY" | python3 -m json.tool

echo ""
echo "============================================"
echo "8. Re-génération manuelle (matin seulement)"
echo "============================================"
DJ_ID=$(curl -s "$BASE/admin/plannings/$PLANNING_ID/day?date=2026-06-15" \
  -H "X-Admin-Api-Key: $KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
matins = [dj for dj in data['demi_journees'] if dj['type'] == 'MATIN']
print(matins[0]['id']) if matins else print('')
")
if [ -n "$DJ_ID" ]; then
  echo ">>> Re-génération de la demi-journée MATIN (ID $DJ_ID) avec 20 min / 0 pause"
  curl -s -X POST "$BASE/admin/demi-journees/$DJ_ID/generate" \
    -H "X-Admin-Api-Key: $KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "matieres": ["Maths", "Physique"],
      "duree_minutes": 20,
      "pause_minutes": 0,
      "statut_initial": "CREE"
    }' | python3 -m json.tool

  echo ""
  echo ">>> Résultat après re-génération :"
  curl -s "$BASE/admin/plannings/$PLANNING_ID/day?date=2026-06-15" \
    -H "X-Admin-Api-Key: $KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for dj in data['demi_journees']:
    print(f\"  {dj['type']} ({dj['heure_debut']}-{dj['heure_fin']}): {len(dj['epreuves'])} épreuves\")
    for e in dj['epreuves']:
        print(f\"    {e['heure_debut']} - {e['heure_fin']} | {e['matiere']} [{e['statut']}]\")
"
fi
