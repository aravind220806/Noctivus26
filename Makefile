SHELL := /bin/sh

PYTHON ?= python3
NPM ?= npm
BACKEND_DIR := backend
FRONTEND_DIR := frontend

.PHONY: help install install-backend install-frontend dev dev-api dev-frontend build test clean

help:
	@printf '%s\n' 'Available targets:'
	@printf '%s\n' '  make install          Install backend and frontend dependencies'
	@printf '%s\n' '  make dev              Start the frontend development server'
	@printf '%s\n' '  make dev-api          Start the FastAPI development server'
	@printf '%s\n' '  make dev-frontend     Start the React/Vite development server'
	@printf '%s\n' '  make build            Build the frontend for production'
	@printf '%s\n' '  make test             Compile-check the Python backend'
	@printf '%s\n' '  make clean            Remove generated frontend and Python cache files'

install: install-backend install-frontend

install-backend:
	$(PYTHON) -m pip install -r $(BACKEND_DIR)/requirements.txt

install-frontend:
	$(NPM) install

dev: dev-frontend

dev-api:
	cd $(BACKEND_DIR) && $(PYTHON) run.py

dev-frontend:
	$(NPM) run dev --workspace $(FRONTEND_DIR)

build:
	$(NPM) run build --workspace $(FRONTEND_DIR)

test:
	$(PYTHON) -m compileall $(BACKEND_DIR)/app $(BACKEND_DIR)/run.py

clean:
	find $(BACKEND_DIR) -type d -name '__pycache__' -prune -exec rm -rf {} +
	rm -rf $(FRONTEND_DIR)/dist
