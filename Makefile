# Makefile for Docker operations
# Usage: make <command>

.PHONY: dev prod build migrate logs clean help

# Default target
.DEFAULT_GOAL := help

# ==========================================
# Development
# ==========================================

dev: ## Start development environment with hot reload
	docker compose -f docker-compose.dev.yml up --build

dev-detached: ## Start development environment in background
	docker compose -f docker-compose.dev.yml up --build -d

dev-down: ## Stop development environment
	docker compose -f docker-compose.dev.yml down

dev-logs: ## View development logs
	docker compose -f docker-compose.dev.yml logs -f

# ==========================================
# Production
# ==========================================

prod: ## Start production environment
	docker compose -f docker-compose.prod.yml up --build -d

prod-down: ## Stop production environment
	docker compose -f docker-compose.prod.yml down

prod-logs: ## View production logs
	docker compose -f docker-compose.prod.yml logs -f

prod-restart: ## Restart production services
	docker compose -f docker-compose.prod.yml restart

# ==========================================
# Database
# ==========================================

migrate: ## Run database migrations (development)
	docker compose -f docker-compose.dev.yml --profile migrate up db-migrate

migrate-prod: ## Run database migrations (production)
	docker compose -f docker-compose.prod.yml --profile migrate up db-migrate

db-studio: ## Open Drizzle Studio (requires local bun)
	cd backend/db && bun run db:studio

# ==========================================
# Building
# ==========================================

build-auth: ## Build auth service image
	docker build -f backend/auth/Dockerfile -t auth-service:latest .

build-connectors: ## Build connectors service image
	docker build -f backend/connectors/Dockerfile -t connectors-service:latest .

build: build-auth build-connectors ## Build all service images

# ==========================================
# Utilities
# ==========================================

logs-auth: ## View auth service logs
	docker compose -f docker-compose.dev.yml logs -f auth

logs-connectors: ## View connectors service logs
	docker compose -f docker-compose.dev.yml logs -f connectors

clean: ## Remove all containers, volumes, and images
	docker compose -f docker-compose.dev.yml down -v --rmi local
	docker compose -f docker-compose.prod.yml down -v --rmi local

prune: ## Clean up unused Docker resources
	docker system prune -af --volumes

# ==========================================
# Local Development (without Docker)
# ==========================================

local-db: ## Start only database services for local development
	docker compose -f docker-compose.dev.yml up postgres redis -d

local-down: ## Stop database services
	docker compose -f docker-compose.dev.yml down

# ==========================================
# Help
# ==========================================

help: ## Show this help message
	@echo "Usage: make <command>"
	@echo ""
	@echo "Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
