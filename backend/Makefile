# SplitBill backend — Docker build & run scripts (AI_NOTES.md §2, SECURITY_RULES.md §2.2).
# ⚠️ `make clean` deletes the database volume — it destroys all data.

COMPOSE := docker compose

.DEFAULT_GOAL := help
.PHONY: help build db up down restart logs ps db-shell app-shell migrate revision test lint dev clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

build: ## Build the app image
	$(COMPOSE) build app

db: ## Start only the database container
	$(COMPOSE) up -d db

up: ## Build (if needed) and start db + app
	$(COMPOSE) up -d --build

down: ## Stop containers (keeps database data)
	$(COMPOSE) down

restart: ## Restart the app container
	$(COMPOSE) restart app

logs: ## Follow logs of all services
	$(COMPOSE) logs -f

ps: ## Show container status
	$(COMPOSE) ps

db-shell: ## psql shell inside the db container
	$(COMPOSE) exec db psql -U splitbill -d splitbill

app-shell: ## Shell inside the app container
	$(COMPOSE) exec app sh

migrate: ## Apply pending database migrations (db must be running: `make db`)
	uv run alembic upgrade head

revision: ## Create a migration: make revision m="add groups table"
	uv run alembic revision -m "$(m)"

test: ## Run the test suite (local uv venv)
	uv run pytest

lint: ## Run ruff check + format check (local uv venv)
	uv run ruff check .
	uv run ruff format --check .

dev: ## Run the app locally with uv (run `make db` first)
	uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

clean: ## ⚠️ Stop everything AND wipe the database volume (destroys data)
	$(COMPOSE) down -v
