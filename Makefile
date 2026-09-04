SHELL := /bin/bash

DOCKER_COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
BACKEND_DIR    := backend
FRONTEND_DIR   := frontend
VENV           := .venv
PYTHON         := $(shell test -f $(VENV)/bin/python && echo $(VENV)/bin/python || echo python3)
NPM            := npm

.PHONY: up down restart build pull logs logs-api logs-web status health \
        dev dev-api dev-frontend \
        setup env install install-backend install-frontend \
        test clean nuke help

all: help

# ── PRODUCTION (Docker) ───────────────────────────────────────────────────────

up: env  ## Build images and start all services
	@echo "→ Building and starting Noctivus..."
	@$(DOCKER_COMPOSE) up -d --build
	@$(MAKE) --no-print-directory health

down:  ## Stop and remove containers
	@echo "→ Stopping services..."
	@$(DOCKER_COMPOSE) down --remove-orphans
	@echo "✓ Stopped"

restart:  ## Rebuild images and restart all services
	@echo "→ Rebuilding and restarting..."
	@$(DOCKER_COMPOSE) up -d --build --force-recreate
	@$(MAKE) --no-print-directory health

build:  ## Build Docker images without starting
	@$(DOCKER_COMPOSE) build --no-cache

pull:  ## git pull + rebuild + restart  [AWS deploy shortcut]
	@echo "→ Pulling latest code..."
	@git pull
	@$(MAKE) --no-print-directory restart

# ── LOGS & STATUS ─────────────────────────────────────────────────────────────

logs:  ## Follow all service logs (Ctrl-C to stop)
	@$(DOCKER_COMPOSE) logs -f --tail=100

logs-api:  ## Follow backend logs only
	@$(DOCKER_COMPOSE) logs -f --tail=100 backend

logs-web:  ## Follow frontend/nginx logs only
	@$(DOCKER_COMPOSE) logs -f --tail=100 frontend

status:  ## Show container status and run health check
	@$(DOCKER_COMPOSE) ps
	@echo ""
	@$(MAKE) --no-print-directory health

health:  ## Check HTTP health of running services
	@echo "→ Checking service health..."
	@for i in $$(seq 1 20); do \
		if curl -sf http://localhost/api/health >/dev/null 2>&1; then \
			echo "✓ Backend API: healthy"; \
			break; \
		fi; \
		if [ $$i -eq 20 ]; then echo "⚠  Backend not responding (may still be starting — run: make logs-api)"; fi; \
		sleep 2; \
	done
	@if curl -sf http://localhost/ >/dev/null 2>&1; then \
		echo "✓ Frontend (Nginx): serving"; \
	fi

# ── LOCAL DEVELOPMENT ─────────────────────────────────────────────────────────

dev: dev-frontend  ## Start frontend Vite dev server

dev-frontend:  ## Start Vite dev server with hot reload
	@cd $(FRONTEND_DIR) && $(NPM) run dev -- --host

dev-api:  ## Start FastAPI backend locally (no Docker)
	@PYTHONPATH=$(BACKEND_DIR) $(PYTHON) $(BACKEND_DIR)/run.py

# ── SETUP ─────────────────────────────────────────────────────────────────────

setup: env install  ## Create .env files and install local dependencies

env:  ## Copy .env.example → .env if not already present
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "✓ Created $(BACKEND_DIR)/.env — fill in secrets before running"; \
	fi
	@if [ ! -f $(FRONTEND_DIR)/.env ] && [ -f $(FRONTEND_DIR)/.env.example ]; then \
		cp $(FRONTEND_DIR)/.env.example $(FRONTEND_DIR)/.env; \
		echo "✓ Created $(FRONTEND_DIR)/.env"; \
	fi

install: install-backend install-frontend  ## Install all local dependencies

install-backend:  ## Install Python deps into .venv
	@python3 -m venv $(VENV) 2>/dev/null || true
	@$(VENV)/bin/pip install --upgrade pip -q
	@$(VENV)/bin/pip install -r $(BACKEND_DIR)/requirements.txt
	@echo "✓ Backend deps installed"

install-frontend:  ## Install Node deps
	@cd $(FRONTEND_DIR) && $(NPM) install
	@echo "✓ Frontend deps installed"

# ── TESTS ─────────────────────────────────────────────────────────────────────

test:  ## Run backend test suite
	@ALLOW_MEMORY_DB=true ENVIRONMENT=development REGISTRATION_OPEN=true \
	  PYTHONPATH=$(BACKEND_DIR) $(PYTHON) -m pytest $(BACKEND_DIR)/tests/ -v

# ── CLEANUP ───────────────────────────────────────────────────────────────────

clean:  ## Remove build artifacts and Python caches
	@find $(BACKEND_DIR) -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find $(BACKEND_DIR) -name "*.pyc" -delete 2>/dev/null || true
	@rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/.vite
	@echo "✓ Cleaned"

nuke: down  ## Stop containers AND delete volumes (destroys local DB — irreversible)
	@echo "⚠  Removing all volumes..."
	@$(DOCKER_COMPOSE) down -v --remove-orphans
	@echo "✓ Done"

# ── HELP ──────────────────────────────────────────────────────────────────────

help:  ## Show this help
	@printf "\n\033[1;36mNoctivus '26\033[0m\n\n"
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*##"}{printf "  \033[1;32m%-18s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
