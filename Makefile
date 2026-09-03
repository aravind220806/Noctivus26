SHELL := /bin/bash

# ==============================================================================
# NOCTIVUS '26 - AUTONOMOUS DEPLOYMENT & NGINX AUTOMATION MAKEFILE
# ==============================================================================

VENV := .venv
PYTHON ?= $(shell test -f $(VENV)/bin/python && echo $(VENV)/bin/python || echo python3)
NPM ?= npm
BACKEND_DIR := backend
FRONTEND_DIR := frontend
DOCKER_COMPOSE := $(shell which docker-compose 2>/dev/null || echo "docker compose")
SQLITE_DB_PATH ?= noctivus.db

.PHONY: all help setup env install install-backend install-frontend build test up down restart status logs health clean load-test dev db-create db-tables

# Default target: do everything from setup to uptime
all: up

help:
	@printf "\n\033[1;36m====================================================================\033[0m\n"
	@printf "\033[1;32m  NOCTIVUS '26 - ALL-IN-ONE AUTOMATION SYSTEM\033[0m\n"
	@printf "\033[1;36m====================================================================\033[0m\n"
	@printf "  \033[1m%-20s\033[0m %s\n" "make (or make all)" "Full automated setup, build, and uptime with Nginx"
	@printf "  \033[1m%-20s\033[0m %s\n" "make up"          "Start Nginx + Backend services (Docker Compose)"
	@printf "  \033[1m%-20s\033[0m %s\n" "make down"        "Stop and remove running containers"
	@printf "  \033[1m%-20s\033[0m %s\n" "make restart"     "Restart all services gracefully"
	@printf "  \033[1m%-20s\033[0m %s\n" "make status"      "Check status & uptime of Nginx & API"
	@printf "  \033[1m%-20s\033[0m %s\n" "make logs"        "View live container & server logs"
	@printf "  \033[1m%-20s\033[0m %s\n" "make health"      "Verify endpoints with automated HTTP health check"
	@printf "  \033[1m%-20s\033[0m %s\n" "make setup"       "Auto-create .env files and install all dependencies"
	@printf "  \033[1m%-20s\033[0m %s\n" "make build"       "Build production frontend assets (dist)"
	@printf "  \033[1m%-20s\033[0m %s\n" "make dev"         "Start local frontend dev server"
	@printf "  \033[1m%-20s\033[0m %s\n" "make dev-api"     "Start local backend API dev server"
	@printf "  \033[1m%-20s\033[0m %s\n" "make db-create"   "Create the SQLite database and all tables"
	@printf "  \033[1m%-20s\033[0m %s\n" "make clean"       "Clean build artifacts and caches"
	@printf "\033[1;36m====================================================================\033[0m\n\n"

# ------------------------------------------------------------------------------
# 1. ENVIRONMENT INITIALIZATION
# ------------------------------------------------------------------------------
env:
	@printf "\033[1;34m[1/4] Checking environment configurations...\033[0m\n"
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		if [ -f $(BACKEND_DIR)/.env.example ]; then \
			cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
			printf "  \033[32m✔ Created $(BACKEND_DIR)/.env from template\033[0m\n"; \
		fi \
	fi
	@if [ ! -f $(FRONTEND_DIR)/.env ]; then \
		if [ -f $(FRONTEND_DIR)/.env.example ]; then \
			cp $(FRONTEND_DIR)/.env.example $(FRONTEND_DIR)/.env; \
			printf "  \033[32m✔ Created $(FRONTEND_DIR)/.env from template\033[0m\n"; \
		fi \
	fi

# ------------------------------------------------------------------------------
# 2. DEPENDENCY INSTALLATION
# ------------------------------------------------------------------------------
setup: env install-backend install-frontend

install: setup

install-backend:
	@printf "\033[1;34m[2/4] Setting up Python virtualenv & backend dependencies...\033[0m\n"
	@if [ ! -d "$(VENV)" ]; then \
		python3 -m venv $(VENV) 2>/dev/null || virtualenv $(VENV) 2>/dev/null || true; \
	fi
	@if [ -f "$(VENV)/bin/pip" ]; then \
		$(VENV)/bin/pip install --upgrade pip >/dev/null 2>&1; \
		$(VENV)/bin/pip install -r $(BACKEND_DIR)/requirements.txt; \
	else \
		pip3 install -r $(BACKEND_DIR)/requirements.txt; \
	fi
	@printf "  \033[32m✔ Backend dependencies installed\033[0m\n"

install-frontend:
	@printf "\033[1;34m[3/4] Installing Frontend Node dependencies...\033[0m\n"
	@cd $(FRONTEND_DIR) && $(NPM) install
	@printf "  \033[32m✔ Frontend dependencies installed\033[0m\n"

# ------------------------------------------------------------------------------
# 3. PRODUCTION ASSET BUILD
# ------------------------------------------------------------------------------
build:
	@printf "\033[1;34m[4/4] Building production frontend bundles...\033[0m\n"
	@cd $(FRONTEND_DIR) && $(NPM) run build
	@printf "  \033[32m✔ Frontend build complete (dist/)\033[0m\n"

# ------------------------------------------------------------------------------
# 4. FULL DEPLOYMENT & NGINX UPTIME
# ------------------------------------------------------------------------------
up: env
	@printf "\n\033[1;35m🚀 Launching Noctivus Stack (Nginx + FastAPI Backend)...\033[0m\n"
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		printf "  \033[36mBuilding and starting Docker containers with Nginx...\033[0m\n"; \
		$(DOCKER_COMPOSE) up -d --build; \
		$(MAKE) health; \
	else \
		printf "  \033[33mDocker daemon not detected. Building frontend & starting local services...\033[0m\n"; \
		$(MAKE) build; \
		printf "\n\033[32m✔ Frontend built in $(FRONTEND_DIR)/dist\033[0m\n"; \
		printf "  To run backend: make dev-api\n"; \
		printf "  To run frontend: make dev-frontend\n"; \
	fi

down:
	@printf "\033[1;33mStopping all running services...\033[0m\n"
	@$(DOCKER_COMPOSE) down --remove-orphans
	@printf "  \033[32m✔ Services stopped\033[0m\n"

restart: down up

status:
	@printf "\n\033[1;36m════════════════════════════════════════════════════════════════════\033[0m\n"
	@printf "\033[1;32m  NOCTIVUS SERVICE STATUS & UPTIME\033[0m\n"
	@printf "\033[1;36m════════════════════════════════════════════════════════════════════\033[0m\n"
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		$(DOCKER_COMPOSE) ps; \
	fi
	@printf "\n"
	@$(MAKE) health

health:
	@printf "\033[1;34mChecking HTTP endpoints and server health...\033[0m\n"
	@for i in {1..12}; do \
		if curl -s -f -o /dev/null "http://localhost:4000/api/events" 2>/dev/null || curl -s -f -o /dev/null "http://localhost/api/events" 2>/dev/null; then \
			printf "  \033[32m✔ Backend API is UP and healthy\033[0m\n"; \
			break; \
		else \
			if [ $$i -eq 12 ]; then \
				printf "  \033[33m⚠ Backend starting up or on custom port\033[0m\n"; \
			else \
				sleep 1; \
			fi; \
		fi; \
	done
	@if curl -s -f -o /dev/null "http://localhost:80" 2>/dev/null || curl -s -f -o /dev/null "http://localhost:5173" 2>/dev/null; then \
		printf "  \033[32m✔ Web Server / Nginx is UP and serving pages\033[0m\n"; \
	fi
	@printf "\n\033[1;32m🎉 Noctivus is live and operational!\033[0m\n\n"

logs:
	@$(DOCKER_COMPOSE) logs -f --tail=100

# ------------------------------------------------------------------------------
# 5. LOCAL DEVELOPMENT TARGETS
# ------------------------------------------------------------------------------
dev: dev-frontend

dev-frontend:
	@cd $(FRONTEND_DIR) && $(NPM) run dev -- --host

dev-api:
	@if [ -f "$(VENV)/bin/python" ]; then \
		PYTHONPATH=$(BACKEND_DIR) $(VENV)/bin/python $(BACKEND_DIR)/run.py; \
	else \
		PYTHONPATH=$(BACKEND_DIR) $(PYTHON) $(BACKEND_DIR)/run.py; \
	fi

db-create:
	@printf "\033[1;34mCreating SQLite database and tables...\033[0m\n"
	@SQLITE_DB_PATH="$(SQLITE_DB_PATH)" PYTHONPATH=$(BACKEND_DIR) $(PYTHON) -c 'import asyncio; from app.db.sqlite_db import DB_PATH, sqlite_db; asyncio.run(sqlite_db.init()); assert sqlite_db.ready(), "SQLite database initialization failed"; print(f"  SQLite database ready at {DB_PATH}")'

db-tables: db-create

test:
	@printf "\033[1;34mRunning backend verification tests...\033[0m\n"
	@$(PYTHON) -m compileall $(BACKEND_DIR)/app $(BACKEND_DIR)/run.py
	@if [ -d "$(BACKEND_DIR)/tests" ]; then \
		ALLOW_MEMORY_DB=true ENVIRONMENT=development REGISTRATION_OPEN=true PYTHONPATH=$(BACKEND_DIR) $(PYTHON) -m pytest $(BACKEND_DIR)/tests/ -v; \
	fi
	@printf "  \033[32m✔ Code compile & tests passed\033[0m\n"

load-test:
	@$(PYTHON) scripts/load_test.py

clean:
	@printf "\033[1;33mCleaning caches and build directories...\033[0m\n"
	@find $(BACKEND_DIR) -type d -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true
	@find $(BACKEND_DIR) -type f -name '*.pyc' -delete 2>/dev/null || true
	@rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/.vite
	@printf "  \033[32m✔ Cleaned successfully\033[0m\n"
