# Izy'Ah — common tasks. Run `make help` for the list.
.DEFAULT_GOAL := help
.PHONY: help up up-build down down-v logs dev-infra ps \
        backend-install backend-dev backend-test backend-typecheck \
        frontend-install frontend-dev frontend-test frontend-typecheck \
        install typecheck test seed

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

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
	docker compose -f docker-compose.dev.yml up -d

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
