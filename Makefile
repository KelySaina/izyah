# Izy'Ah — common tasks. Run `make help` for the list.
.DEFAULT_GOAL := help
.PHONY: help up up-build down down-v logs dev-infra dev-down dev-ps dev-logs ps sync sync-seed \
        backend-install backend-dev backend-test backend-typecheck \
        frontend-install frontend-dev frontend-test frontend-typecheck \
        install typecheck test seed

# Dev-infra file set. docker-compose.local.yml is gitignored and holds this
# machine's overrides (e.g. remapping the Postgres container to host 5433 when a
# native Postgres already owns 5432), so every dev-stack command must include it
# when it exists. Leaving it out doesn't just lose the override — compose then
# resolves a *different* spec, so a recreate tries to bind the original port and
# fails, and `config --hash` reports drift that isn't there. scripts/dev-sync.sh
# follows the same rule; use the dev-* targets below rather than a bare
# `docker compose -f docker-compose.dev.yml`.
DEV_COMPOSE := -f docker-compose.dev.yml $(if $(wildcard docker-compose.local.yml),-f docker-compose.local.yml,)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

## ---- Multi-machine sync ----
sync: ## Pull + reconcile .env + deps + infra + migrations (use on your other computer)
	bash scripts/dev-sync.sh

sync-seed: ## Same as `sync`, then re-seed demo data
	bash scripts/dev-sync.sh --seed

## ---- Docker (full stack) ----
up: ## Start the whole stack
	docker compose up

up-build: ## Rebuild images and start
	docker compose up --build

down: ## Stop the stack (keep data)
	docker compose down

down-v: ## Stop the stack and wipe volumes
	docker compose down -v

logs: ## Tail all logs
	docker compose logs -f

ps: ## Show service status
	docker compose ps

dev-infra: ## Start infra only (Postgres/Redis/MinIO/Adminer) for native dev
	@echo "compose files:$(DEV_COMPOSE)"
	docker compose $(DEV_COMPOSE) up -d

dev-down: ## Stop the dev infra (keep data)
	docker compose $(DEV_COMPOSE) down

dev-ps: ## Show dev infra status + published ports
	docker compose $(DEV_COMPOSE) ps

dev-logs: ## Tail dev infra logs
	docker compose $(DEV_COMPOSE) logs -f

## ---- Backend ----
backend-install: ## Install backend deps
	cd apps/backend && npm install

backend-dev: ## Run backend in watch mode
	cd apps/backend && npm run dev

backend-test: ## Run backend tests
	cd apps/backend && npm test

backend-typecheck: ## Typecheck backend
	cd apps/backend && npm run typecheck

seed: ## Seed the database (backend)
	cd apps/backend && npm run db:seed

## ---- Frontend ----
frontend-install: ## Install frontend deps
	cd apps/frontend && npm install

frontend-dev: ## Run frontend in watch mode
	cd apps/frontend && npm run dev

frontend-test: ## Run frontend unit tests
	cd apps/frontend && npm run test:unit

frontend-typecheck: ## Typecheck frontend
	cd apps/frontend && npm run typecheck

## ---- Aggregate ----
install: backend-install frontend-install ## Install everything
typecheck: backend-typecheck frontend-typecheck ## Typecheck everything
test: backend-test frontend-test ## Test everything
