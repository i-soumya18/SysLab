.PHONY: help dev dev-up dev-down dev-logs dev-logs-frontend dev-logs-backend dev-clean build build-frontend build-backend test test-frontend test-backend shell-frontend shell-backend

# Development environment management
dev: dev-up
	@echo "Development environment is running"

dev-up:
	@chmod +x scripts/start-dev.sh
	@./scripts/start-dev.sh

dev-down:
	@chmod +x scripts/stop-dev.sh
	@./scripts/stop-dev.sh

dev-logs:
	docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.dev.yml logs -f

dev-logs-frontend:
	docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.dev.yml logs -f frontend

dev-logs-backend:
	docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.dev.yml logs -f backend

dev-clean:
	docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.dev.yml down -v

# Building
build: build-backend build-frontend

build-backend:
	docker compose -f infra/compose/docker-compose.yml build backend

build-frontend:
	docker compose -f infra/compose/docker-compose.yml build frontend

# Testing
test: test-frontend test-backend

test-frontend:
	cd apps/frontend && npm test

test-backend:
	cd apps/backend && npm test

# Shell access
shell-frontend:
	docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.dev.yml exec frontend sh

shell-backend:
	docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.dev.yml exec backend sh

# Shortcuts
logs: dev-logs
up: dev-up
down: dev-down
clean: dev-clean

# Help
help:
	@echo "System Design Simulator - Make Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start development environment"
	@echo "  make dev-up           Start services"
	@echo "  make dev-down         Stop services"
	@echo "  make dev-logs         View all logs"
	@echo "  make dev-logs-frontend View frontend logs"
	@echo "  make dev-logs-backend  View backend logs"
	@echo "  make dev-clean        Remove all containers and volumes"
	@echo ""
	@echo "Building:"
	@echo "  make build            Build all services"
	@echo "  make build-backend    Build backend only"
	@echo "  make build-frontend   Build frontend only"
	@echo ""
	@echo "Testing:"
	@echo "  make test             Run all tests"
	@echo "  make test-frontend    Test frontend only"
	@echo "  make test-backend     Test backend only"
	@echo ""
	@echo "Access:"
	@echo "  make shell-frontend   Open frontend container shell"
	@echo "  make shell-backend    Open backend container shell"
	@echo ""
	@echo "Shortcuts:"
	@echo "  make up               Alias for dev-up"
	@echo "  make down             Alias for dev-down"
	@echo "  make logs             Alias for dev-logs"
	@echo "  make clean            Alias for dev-clean"
	@echo ""
