.PHONY: dev preprod-up preprod-down prod-up prod-down logs build help

# ── Développement local (sans Docker) ─────────────────────────────────────────
dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

# ── Docker Dev ────────────────────────────────────────────────────────────────
dev-docker-up:
	docker compose -f docker-compose.dev.yml up --build

dev-docker-down:
	docker compose -f docker-compose.dev.yml down

# ── Pré-production ────────────────────────────────────────────────────────────
preprod-build:
	docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml build

preprod-up:
	docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml up -d

preprod-down:
	docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml down

preprod-logs:
	docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.preprod.yml logs -f

# ── Production ────────────────────────────────────────────────────────────────
prod-build:
	docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml build

prod-up:
	docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down:
	docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml down

prod-logs:
	docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs -f

# ── Utilitaires ───────────────────────────────────────────────────────────────
generate-secrets:
	@echo "ADMIN_API_KEY=$$(openssl rand -hex 32)"
	@echo "SECRET_KEY=$$(openssl rand -hex 32)"
	@echo "POSTGRES_PASSWORD=$$(openssl rand -base64 32)"

prod-shell-backend:
	docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec backend bash

prod-shell-db:
	docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec db psql -U $${POSTGRES_USER:-oraux_prod} $${POSTGRES_DB:-oraux_prod}

help:
	@echo "Commandes disponibles:"
	@echo "  make dev-backend      — Lance le backend FastAPI en local"
	@echo "  make dev-frontend     — Lance le frontend Next.js en local"
	@echo "  make dev-docker-up    — Lance tout en Docker (dev)"
	@echo "  make preprod-up       — Démarre la pré-production"
	@echo "  make prod-up          — Démarre la production"
	@echo "  make generate-secrets — Génère des secrets sécurisés"
	@echo "  make prod-logs        — Logs de production en temps réel"
