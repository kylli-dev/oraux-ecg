# Guide IT — Plateforme Oraux-ECG

**Public cible :** Membre de l'équipe IT ENSAE prenant en charge la plateforme  
**Dernière mise à jour :** Mai 2026  
**Serveur de production :** SV-ORAUX-ENSAE (`dsit@sv-oraux-ensae`)  
**Domaine :** https://oraux.ensae.fr

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Structure des fichiers](#3-structure-des-fichiers)
4. [Dépendances backend](#4-dépendances-backend)
5. [Modèles de données (24 modèles)](#5-modèles-de-données)
6. [API Backend (18 routers)](#6-api-backend)
7. [Frontend — Routes API](#7-frontend--routes-api-next.js)
8. [Frontend — Pages](#8-frontend--pages)
9. [Variables d'environnement](#9-variables-denvironnement)
10. [Déploiement](#10-déploiement)
11. [Fonctionnement opérationnel](#11-fonctionnement-opérationnel)
12. [Sécurité](#12-sécurité)
13. [Opérations courantes](#13-opérations-courantes)
14. [Résolution de problèmes](#14-résolution-de-problèmes)

---

## 1. Vue d'ensemble

La plateforme **Oraux-ECG** est une application web de gestion des oraux du concours ECG (prépa économique). Elle permet :

- La **planification** des créneaux d'examen (demi-journées, gabarits, épreuves)
- L'**inscription des candidats** aux triplets de 3 épreuves
- L'**accès au portail candidat** (consultation, inscription, notes)
- L'**accès au portail examinateur** (planning, saisie des notes)
- L'**accès au portail surveillant** (planning, gestion des absences)
- La **gestion administrative** complète depuis l'interface admin

**Stack technique :**

| Composant | Technologie |
|-----------|------------|
| Backend API | Python 3 + FastAPI |
| Base de données | PostgreSQL 16 |
| Frontend | Next.js 16 + React 19 + TypeScript |
| Reverse proxy | Nginx |
| Conteneurisation | Docker + Docker Compose |
| SSL | Let's Encrypt (Certbot) |

---

## 2. Architecture technique

```
Internet
   │
   ▼
[Nginx :443/80]  ←── /etc/letsencrypt (certificats Let's Encrypt)
   │
   ├── /api/v1/*      → [Backend FastAPI :8000]  ←── [PostgreSQL :5432]
   ├── /portal/*      → [Backend FastAPI :8000]
   └── /*             → [Frontend Next.js :3000]
                              │
                              └── /api/backend/* → [Backend FastAPI :8000]
                                  (proxy interne via X-Admin-Api-Key)
```

**Flux d'authentification admin :**
1. `POST /api/auth/login` (Next.js route) → vérifie `ADMIN_PASSWORD`
2. Émet un cookie httpOnly `admin_session` (JWT signé avec `JWT_SECRET`, durée 24h)
3. Les appels au backend passent par `/api/backend/[...path]` qui injecte le header `X-Admin-Api-Key`

**Flux d'authentification candidat :**
1. `POST /portal/login` (FastAPI direct) → vérifie INE + mot de passe
2. Retourne un token JWT signé avec `SECRET_KEY`

---

## 3. Structure des fichiers

```
oraux-ecg/
├── backend/
│   ├── app/
│   │   ├── main.py              # Point d'entrée FastAPI, migrations au démarrage
│   │   ├── api/                 # 18 routers FastAPI
│   │   ├── models/              # 24 modèles SQLAlchemy
│   │   ├── schemas/             # Schémas Pydantic (validation)
│   │   ├── services/            # Logique métier
│   │   ├── core/                # Auth, guards, config
│   │   └── db/                  # Session DB, base déclarative
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── api/                 # 6 route handlers Next.js
│   │   ├── admin/               # Interface d'administration
│   │   ├── candidat/            # Portail candidat
│   │   ├── examinateur/         # Portail examinateur
│   │   ├── surveillant/         # Portail surveillant
│   │   └── plannings/           # Vue détaillée d'un planning
│   ├── package.json
│   └── Dockerfile
│
├── nginx/
│   └── nginx.conf               # Config reverse proxy + SSL
│
├── docker-compose.yml           # Base (production)
├── docker-compose.dev.yml       # Surcharge développement
├── docker-compose.preprod.yml   # Surcharge pré-production
├── docker-compose.prod.yml      # Surcharge production
├── Makefile                     # Commandes dev/preprod/prod
├── .env                         # Variables dev local (ne pas committer en prod)
├── .env.preprod.example         # Template pré-production
└── .env.prod.example            # Template production
```

---

## 4. Dépendances backend

**Fichier :** `backend/requirements.txt`

| Package | Version | Usage |
|---------|---------|-------|
| fastapi | 0.115.12 | Framework web API |
| uvicorn | 0.34.0 | Serveur ASGI |
| SQLAlchemy | 2.0.36 | ORM base de données |
| psycopg2-binary | 2.9.10 | Adaptateur PostgreSQL |
| alembic | 1.14.0 | Migrations DB (non utilisé — migrations manuelles au démarrage) |
| bcrypt | 4.2.1 | Hachage des mots de passe |
| python-jose[cryptography] | 3.3.0 | Génération/vérification JWT |
| openpyxl | 3.1.5 | Import/export Excel |
| pypdf | 5.1.0 | Lecture fichiers PDF |
| reportlab | 4.2.5 | Génération PDF |
| python-multipart | 0.0.20 | Upload de fichiers |
| python-dotenv | 1.0.1 | Chargement des `.env` |

---

## 5. Modèles de données

La base de données comprend **24 modèles SQLAlchemy**. Le schéma évolue via ~40 migrations `ALTER TABLE` exécutées automatiquement au démarrage du backend (`main.py`).

### Modèles de planification

| Modèle | Table | Description |
|--------|-------|-------------|
| **Planning** | `plannings` | Événement d'examen principal (dates, fenêtres d'inscription, paramètres comportementaux) |
| **DemiJournee** | `demi_journees` | Demi-journée (date + MATIN/APRES_MIDI). Clé unique : planning_id + date + type |
| **JourneeType** | `journee_types` | Gabarit/template de journée (durées par défaut) |
| **JourneeTypeBloc** | `journee_type_blocs` | Bloc dans un gabarit (GENERATION ou PAUSE). Support matrice custom JSON |
| **Epreuve** | `epreuves` | Créneau d'examen individuel : horaire, matière, candidat, examinateur(s), salle, surveillant, planche |

### Modèles de personnel

| Modèle | Table | Description |
|--------|-------|-------------|
| **Candidat** | `candidats` | Données civiles complètes (INE, date naissance, handicap), établissement, identifiants de connexion |
| **Examinateur** | `examinateurs` | Examinateur avec liste de matières (JSON), code d'accès, statut actif |
| **ExaminateurPlanning** | `examinateur_planning` | Table de liaison Examinateur ↔ Planning |
| **Surveillant** | `surveillants` | Surveillant avec email, code d'accès, hash mot de passe |
| **SurveillantPlanning** | `surveillant_planning` | Table de liaison Surveillant ↔ Planning |

### Modèles d'inscription

| Modèle | Table | Description |
|--------|-------|-------------|
| **Inscription** | `inscriptions` | Inscription d'un candidat à un triplet de 3 épreuves. Statut : ACTIVE / ANNULEE |
| **InscriptionEpreuve** | `inscription_epreuves` | Lien Inscription ↔ Epreuve (3 par inscription) |
| **ListeAttente** | `liste_attente` | Candidat en liste d'attente pour une date donnée |

### Modèles de notation

| Modèle | Table | Description |
|--------|-------|-------------|
| **Note** | `notes` | Note brute + note harmonisée + commentaire. Statut : BROUILLON / PUBLIE |

### Modèles de référence

| Modèle | Table | Description |
|--------|-------|-------------|
| **Matiere** | `matieres` | Matière/discipline (intitulé unique, flag actif) |
| **Salle** | `salles` | Salle d'examen (intitulé unique, flag actif) |
| **Planche** | `planches` | Sujet PDF stocké en binaire (BYTEA). Associé à une matière et un examinateur |
| **Etablissement** | `etablissements` | Référentiel établissements (code UAI unique, nom, localisation) |
| **ExaminateurIndisponibilite** | `examinateur_indisponibilites` | Indisponibilités des examinateurs (start/end datetime) |
| **MessageType** | `message_types` | Templates d'emails (ADMISSIBILITE, CONVOCATION…) avec variables |
| **PlanningMatiereSalleDefaut** | `planning_matiere_salle_defaut` | Affectations salle par défaut : Planning × Matière → Salle |

### Colonnes communes

- `id` : clé primaire entière auto-incrémentée
- `created_at`, `updated_at` : timestamps automatiques sur la plupart des modèles
- Les PDF sont stockés **directement en base** (colonne `fichier_data BYTEA`)

---

## 6. API Backend

Le backend FastAPI est accessible sur le port **8000**. Tous les endpoints `/admin/*` nécessitent le header `X-Admin-Api-Key`.

### Endpoints de santé

```
GET  /          → {"service": "oraux-ecg", "status": "ok"}
GET  /health    → {"status": "ok"}
GET  /db-check  → Vérification connectivité DB + schéma
```

### Routers admin (préfixe `/admin/`)

| Router | Préfixe complet | Fonctions principales |
|--------|----------------|----------------------|
| plannings | `/admin/plannings` | CRUD plannings, création demi-journées, application gabarits, vue jour, import/export Excel |
| demi_journees | `/admin/demi-journees` | CRUD demi-journées |
| journee_types | `/admin/journee-types` | CRUD gabarits, prévisualisation génération |
| epreuves | `/admin/epreuves` | CRUD créneaux, swap de rangées, application salles par défaut |
| candidats | `/admin/candidats` | CRUD candidats, import Excel, affectation aux épreuves |
| examinateurs | `/admin/examinateurs` | CRUD examinateurs, affectation en masse, indisponibilités |
| surveillants | `/admin/surveillants` | CRUD surveillants, lien aux plannings |
| conflits | `/admin/conflits` | Détection conflits établissement (candidat ↔ examinateur via code_uai) |
| notes | `/admin/notes` | Consultation notes, publication, harmonisation |
| parametrages | `/admin/parametrages` | Templates email, reset mdp, matières/salles, établissements |
| excel | `/admin/excel` | Import/export planning, candidats, examinateurs |
| gestion_candidats | `/admin/gestion-candidats` | Interface gestion candidats (fiche, inscription, liste d'attente, triplets) |
| planches | `/admin/planches` | Gestion sujets PDF, upload, affectation aux épreuves |

### Routers portails (sans clé admin)

| Router | Préfixe | Fonctions principales |
|--------|---------|----------------------|
| portal | `/portal` | Login candidat, reset mdp, planning, inscription, notes |
| examinateur_portal | `/examinateur` | Login examinateur (code_acces), planning, saisie notes, export |
| surveillant_portal | `/surveillant` | Login surveillant, planning, marquage absences, export |

---

## 7. Frontend — Routes API (Next.js)

Ces routes sont des **handlers Next.js** (pas des pages) situés dans `frontend/app/api/`.

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/auth/login` | POST | Authentification admin → cookie httpOnly `admin_session` (JWT 24h) |
| `/api/auth/logout` | POST | Supprime le cookie `admin_session` |
| `/api/backend/[...path]` | GET/POST/PUT/PATCH/DELETE | **Proxy principal** vers FastAPI `/admin/*` avec injection `X-Admin-Api-Key`. Gère les réponses binaires (PDF, Excel, ZIP) |
| `/api/day` | GET | Proxy vue-jour (`planning_id` + `date`) |
| `/api/plannings` | GET | Liste des plannings |
| `/api/ping` | GET | Health check avec auth optionnelle via `CRON_SECRET` |

> **Important :** Les appels admin du frontend ne vont **jamais directement** au backend. Ils passent tous par `/api/backend/[...path]` qui ajoute la clé API. La clé `ADMIN_API_KEY` n'est donc jamais exposée côté navigateur.

---

## 8. Frontend — Pages

### Interface admin (`/admin/`)

| Page | Description |
|------|-------------|
| `/admin/login` | Authentification administrateur |
| `/admin` | Dashboard + gestion planification (page principale ~15 000 lignes) |
| `/admin/planification` | Interface de planification avancée |
| `/admin/conflits` | Détection et résolution des conflits établissement |

### Portail candidat (`/candidat/`)

| Page | Description |
|------|-------------|
| `/candidat/accueil` | Tableau de bord candidat |
| `/candidat/planning` | Consultation planning + inscription aux triplets |
| `/candidat/notes` | Consultation des notes publiées |
| `/candidat/liste-attente` | Gestion de la liste d'attente |
| `/candidat/changer-mot-de-passe` | Modification mot de passe |
| `/candidat/mot-de-passe-oublie` | Demande de reset mot de passe |
| `/candidat/reinitialiser-mot-de-passe` | Confirmation reset avec token |

### Portail examinateur (`/examinateur/`)

| Page | Description |
|------|-------------|
| `/examinateur/accueil` | Tableau de bord examinateur |
| `/examinateur/planning` | Planning + saisie des notes |
| `/examinateur/code-perdu` | Récupération code d'accès |

### Portail surveillant (`/surveillant/`)

| Page | Description |
|------|-------------|
| `/surveillant/accueil` | Tableau de bord surveillant |
| `/surveillant/planning` | Planning + marquage des absences |

---

## 9. Variables d'environnement

### Variables obligatoires en production

| Variable | Service | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | db, backend | Nom de la base de données |
| `POSTGRES_USER` | db, backend | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | db, backend | Mot de passe PostgreSQL (**fort requis**) |
| `DATABASE_URL` | backend | URL complète : `postgresql://user:pass@db:5432/dbname` |
| `ADMIN_API_KEY` | backend, frontend | Clé secrète pour les appels API admin (`openssl rand -hex 32`) |
| `SECRET_KEY` | backend | Clé de signature JWT backend (`openssl rand -hex 32`) |
| `CORS_ORIGINS` | backend | Origines CORS autorisées (ex: `https://oraux.ensae.fr`) |
| `ADMIN_PASSWORD` | frontend | Mot de passe de l'interface admin |
| `JWT_SECRET` | frontend | Clé de signature JWT frontend (`openssl rand -hex 32`) |
| `HTTP_PORT` | nginx | Port HTTP (défaut: 80) |
| `HTTPS_PORT` | nginx | Port HTTPS (défaut: 443) |

### Variables build-time frontend (NEXT_PUBLIC_*)

> Ces variables sont **compilées dans le bundle JavaScript** au moment du `docker build`. Modifier le `.env` sans rebuilder n'a aucun effet.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | URL de base de l'API (vide = URLs relatives via proxy nginx) |
| `NEXT_PUBLIC_API_URL` | URL de l'API publique |
| `NEXT_PUBLIC_ADMIN_API_KEY` | Clé admin côté navigateur (identique à `ADMIN_API_KEY`) |

### Générer des secrets sécurisés

```bash
# Clé hexadécimale 32 octets
openssl rand -hex 32

# Mot de passe base64
openssl rand -base64 32
```

---

## 10. Déploiement

### Déploiement initial (premier démarrage)

```bash
# 1. Cloner le dépôt
git clone <url-repo> ~/oraux-ecg
cd ~/oraux-ecg

# 2. Créer le fichier .env de production
cp .env.prod.example .env.prod
nano .env.prod  # Remplir toutes les valeurs

# 3. Obtenir le certificat SSL (Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d oraux.ensae.fr
# Les certificats sont dans /etc/letsencrypt/live/oraux.ensae.fr/

# 4. Builder et démarrer
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Vérifier que tout tourne
docker compose ps
docker compose logs -f
```

### Mise à jour après modification du code

```bash
git pull

# Si modification du backend Python :
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml build backend
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d backend

# Si modification du frontend :
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml build frontend
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d frontend

# Si modification de nginx.conf :
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml restart nginx

# Mise à jour complète :
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d
```

> **Important :** `docker compose restart` **ne recharge pas** les variables d'environnement. Toujours utiliser `up -d` après une modification du `.env`.

### Renouvellement du certificat SSL

Let's Encrypt expire tous les **90 jours**. Procédure :

```bash
# Arrêter nginx pour libérer le port 80
docker compose stop nginx

# Renouveler le certificat
sudo certbot renew

# Redémarrer nginx
docker compose start nginx
```

Il est recommandé de configurer un **cron mensuel** :

```bash
# Ajouter via : sudo crontab -e
0 3 1 * * docker compose -f /home/dsit/oraux-ecg/docker-compose.yml stop nginx && certbot renew --quiet && docker compose -f /home/dsit/oraux-ecg/docker-compose.yml start nginx
```

### Commandes Make disponibles

```bash
# Développement local
make dev-backend          # Lance le backend Python localement
make dev-frontend         # Lance le frontend Next.js localement
make dev-docker-up        # Stack Docker complète en dev
make dev-docker-down      # Arrêt stack dev

# Pré-production
make preprod-build        # Build conteneurs preprod
make preprod-up           # Démarrage services preprod
make preprod-logs         # Streaming des logs
make preprod-down         # Arrêt services preprod

# Production
make prod-build           # Build conteneurs production
make prod-up              # Démarrage services production
make prod-shell-backend   # Shell dans le conteneur backend
make prod-shell-db        # Shell PostgreSQL

# Utilitaires
make generate-secrets     # Génère des secrets sécurisés
```

---

## 11. Fonctionnement opérationnel

### Workflow de planification (admin)

1. **Créer un Planning** — définir les dates, les fenêtres d'inscription candidats
2. **Créer les DemiJournees** — pour chaque date : matin et/ou après-midi
3. **Appliquer un gabarit (JourneeType)** — la génération crée automatiquement les `Epreuves`
4. **Affecter candidats, examinateurs, salles** aux épreuves
5. **Détecter les conflits** — même établissement candidat ↔ examinateur
6. **Publier les notes** après les oraux

### Algorithme de génération des créneaux (N²)

La génération des triplets suit une **rotation N²** :
- Pour chaque date, les candidats tournent entre les salles selon leur profil
- Profils ECG : les candidats **ESH** n'ont pas d'épreuve **HGG** et vice versa
- Constante `_PROFIL_EXCLUSION = {"HGG": "ESH", "ESH": "HGG"}` dans `gestion_candidats.py`
- La déduplication utilise des `frozenset` pour éviter les triplets en double

### Workflow candidat

1. Le candidat consulte `/candidat/planning` → voit les triplets disponibles pour sa date
2. Il s'inscrit (3 épreuves simultanées) ou rejoint la liste d'attente
3. Il consulte `/candidat/notes` après publication par l'admin

### Workflow examinateur

1. L'examinateur accède via son `code_acces` (pas de mot de passe)
2. Il consulte son planning sur `/examinateur/planning`
3. Il saisit les notes — statut BROUILLON jusqu'à publication admin

### Workflow surveillant

1. Accès via code d'accès ou identifiants
2. Consultation planning sur `/surveillant/planning`
3. Marquage des absences candidats

---

## 12. Sécurité

### Mécanismes en place

| Mécanisme | Détail |
|-----------|--------|
| **HTTPS** | Let's Encrypt, TLS 1.2/1.3, HSTS activé |
| **API Key admin** | Header `X-Admin-Api-Key` sur tous les endpoints admin |
| **Cookie httpOnly** | JWT `admin_session` inaccessible depuis JavaScript |
| **Hachage mots de passe** | bcrypt avec salt |
| **JWT signés** | HS256, expiration 24h (admin) |
| **Tokens reset** | Tokens à usage unique et expiration pour reset mdp |
| **CORS whitelist** | Origines explicitement déclarées |
| **En-têtes sécurité nginx** | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |

### Bonnes pratiques

- Le fichier `.env.prod` doit avoir des permissions restreintes : `chmod 600 .env.prod`
- Les secrets doivent être différents entre dev et production
- Ne jamais committer le `.env.prod` dans Git
- Renouveler les clés si un accès non autorisé est suspecté

### Rotation des secrets (si compromission)

```bash
# Générer de nouveaux secrets
openssl rand -hex 32  # Pour ADMIN_API_KEY, SECRET_KEY, JWT_SECRET

# Mettre à jour .env.prod
nano .env.prod

# Rebuilder le frontend (NEXT_PUBLIC_ADMIN_API_KEY est build-time)
docker compose build frontend
docker compose up -d
```

---

## 13. Opérations courantes

### Accéder à la base de données

```bash
# Shell PostgreSQL
docker compose exec db psql -U oraux -d oraux_prod

# Lister les tables
\dt

# Exemple : compter les candidats
SELECT COUNT(*) FROM candidats;

# Sauvegarder la base
docker compose exec db pg_dump -U oraux oraux_prod > backup_$(date +%Y%m%d).sql

# Restaurer depuis une sauvegarde
docker compose exec -T db psql -U oraux oraux_prod < backup_20260101.sql
```

### Consulter les logs

```bash
# Tous les services
docker compose logs -f

# Un service spécifique
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# Dernières 100 lignes
docker compose logs --tail=100 backend
```

### Redémarrer un service

```bash
# Redémarrage simple (sans rechargement env)
docker compose restart nginx

# Redémarrage avec rechargement env (après modification .env)
docker compose up -d backend
docker compose up -d frontend
```

### Vérifier l'état des services

```bash
docker compose ps
docker compose top
```

### Changer le mot de passe admin

```bash
# Modifier dans .env.prod
sed -i 's/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=nouveau_mdp_fort/' .env.prod

# Recharger le frontend (mot de passe vérifié par le frontend)
docker compose up -d frontend
```

### Ajouter une matière ou une salle

Se fait depuis l'interface admin → Paramétrage → Matières/Salles.

---

## 14. Résolution de problèmes

### Le site ne répond pas (502 Bad Gateway)

```bash
docker compose ps           # Vérifier que tous les services sont UP
docker compose logs nginx   # Voir les erreurs nginx
docker compose logs backend # Voir les erreurs backend
docker compose logs frontend # Voir les erreurs frontend

# Redémarrer tous les services
docker compose up -d
```

### Erreur 413 lors de l'upload d'une planche PDF

Vérifier dans `nginx/nginx.conf` :
```nginx
client_max_body_size 50m;
```
Si absent ou trop petit, augmenter puis `docker compose restart nginx`.

### Login admin retourne 401

Causes possibles :
1. **Mauvais mot de passe** — vérifier `ADMIN_PASSWORD` dans `.env.prod`
2. **Frontend pas rechargé** après changement `.env` — faire `docker compose up -d frontend`
3. **JWT_SECRET changé** — les cookies existants sont invalides, se reconnecter

### Les créneaux ne s'affichent pas pour une date

Causes possibles :
1. **Backend pas rebuildet** après modification Python — `docker compose build backend && docker compose up -d backend`
2. **Profil candidat mal détecté** — vérifier le champ `profil` ou `classe` du candidat
3. **Gabarit non appliqué** pour cette date — vérifier dans l'admin que la demi-journée a des épreuves

### Certificat SSL expiré

```bash
docker compose stop nginx
sudo certbot renew
docker compose start nginx
```

### Base de données inaccessible

```bash
docker compose logs db     # Voir les erreurs PostgreSQL
docker compose restart db  # Redémarrer si nécessaire

# Vérifier la santé
docker compose exec db pg_isready -U oraux
```

### Récupérer de l'espace disque (images Docker)

```bash
# Supprimer les images non utilisées
docker image prune -f

# Supprimer toutes les ressources non utilisées
docker system prune -f
```

---

## Contacts et ressources

| Ressource | Détail |
|-----------|--------|
| Dépôt Git | (voir configuration projet) |
| Serveur | `dsit@sv-oraux-ensae` |
| Domaine | https://oraux.ensae.fr |
| Certificat SSL | `/etc/letsencrypt/live/oraux.ensae.fr/` |
| Données PostgreSQL | Volume Docker `pgdata` |
