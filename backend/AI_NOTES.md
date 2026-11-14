# AI_NOTES.md — Development Rules for SplitBill Backend

This file is the **source of truth** for anyone (human or AI) writing code in this project.
Read it fully before adding or changing code. If the API contract changes, update this file in the same commit.

> ⚠️ Security actions (deletions, dependencies, secrets, auth changes) are additionally governed by
> [SECURITY_RULES.md](SECURITY_RULES.md) — on security matters, that file takes precedence over this one.

---

## 1. Project Overview

- **What:** Split-bill REST API — groups, expenses, balances.
- **Stack:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async) + psycopg 3, **PostgreSQL 16** (Docker Compose).
- **Environment:** managed with **uv** (already created in `.venv/`).
- **Currency:** THB, always exactly **2 decimal places**.
- **Frontend** lives in the sibling `frontend/` folder — never touch it from this backend.

### 1.1 Engineering Standards (non-negotiable)

1. **Database schema only via Alembic migrations.** Never create or alter tables by hand, with
   `create_all()`, or in app code. Every change = generated revision (`make revision m="..."`),
   reviewed like code, applied with `make migrate`. Never edit an already-applied migration.
2. **Configuration through environment variables only — no hardcoded values.** All paths, URLs,
   and secrets live in `.env` (§3.6); `.env.example` is the committed template. Source code and
   docker-compose contain **no secret defaults**: credential fields in `Settings` are required and
   the app fails fast at startup if they are missing (SECURITY_RULES.md §2.4).
3. **Consistent JSON errors.** Every error response has the shape `{"detail": "<message>"}` (§6),
   implemented in `app/presentation/error_handlers.py`; request-schema violations → `422`,
   business violations → the mapped 4xx.
4. **Formatted & linted code.** Python: Ruff — `uv run ruff format . && uv run ruff check .` must
   pass before finishing a change. TypeScript (frontend repo): ESLint.
5. **Clear separation of routing / business rules / data access** = `presentation/` /
   `application/` + `domain/` / `infrastructure/` per §3.2 — enforced by the import table.

---

## 2. Commands — uv only

Never use `pip`, `python -m venv`, or system python directly. Always go through `uv`.

| Task | Command |
|---|---|
| Sync env from lockfile | `uv sync` |
| Add a runtime dependency | `uv add <package>` |
| Add a dev dependency | `uv add --dev <package>` |
| Run the dev server | `uv run uvicorn app.main:app --reload` |
| Run all tests | `uv run pytest` |
| Lint + format | `uv run ruff check . && uv run ruff format .` |
| Build & start db + app (Docker) | `make up` |
| Start only the database | `make db` |
| Stop containers (keeps db data) | `make down` |
| Follow logs | `make logs` |
| psql shell in db container | `make db-shell` |
| ⚠️ Stop AND wipe database data | `make clean` |
| Apply database migrations | `make migrate` |
| Generate a migration | `make revision m="add groups table"` |
| Add demo users + households | `make seed` |

> Status: `pyproject.toml` + `uv.lock` exist. Runtime deps: fastapi, uvicorn, pydantic-settings,
> sqlalchemy[asyncio], psycopg[binary], alembic. Dev group: pytest, httpx, ruff. Password hashing
> uses the standard library (`hashlib.scrypt`) — no extra dependency.
>
> Demo data: `make seed` adds users alice/bob/carol/dave (password from `SEED_DEMO_PASSWORD` in
> `.env`), three households and a few bills. Safe to re-run. After `uv add`/`uv remove`
> run `uv sync` so `uv.lock` updates — Docker builds with `--frozen` and will fail on a stale lock.

---

## 3. Clean Architecture

### 3.1 Directory structure

```
backend/
├── AI_NOTES.md
├── README.md
├── pyproject.toml
├── uv.lock
├── Dockerfile
├── docker-compose.yml        # postgres:16-alpine + app
├── Makefile                  # build/run scripts (`make help`)
├── .dockerignore
├── .env                      # local only — git-ignored (SECURITY_RULES.md §3.6)
├── .env.example              # committed template
├── alembic.ini
├── migrations/               # Alembic — schema changes ONLY via revisions here
│   ├── env.py                #   wired to app Settings (env-driven URL)
│   └── versions/
├── app/
│   ├── main.py                  # composition root: create app, wire everything
│   ├── domain/                  # LAYER 1 — pure business core
│   │   ├── entities.py          #   User, Group, Share, NewExpense, Expense (dataclasses)
│   │   ├── money.py             #   parse_amount (string → satang), format_cents
│   │   ├── splits.py            #   equal_split, exact_split
│   │   ├── balances.py          #   compute_balances
│   │   └── errors.py            #   DomainError and subclasses (one per HTTP outcome)
│   ├── application/             # LAYER 2 — use cases
│   │   ├── use_cases/           #   auth.py (AuthService), groups.py (GroupService),
│   │   │                        #   expenses.py (ExpenseService, CreateExpenseCommand)
│   │   ├── ports.py             #   repositories, IdempotencyStore, UnitOfWork, PasswordHasher
│   │   └── dto.py               #   GroupView, ExpenseView, BalanceView, IdempotencyRecord...
│   ├── infrastructure/          # LAYER 4 — implementations
│   │   ├── config.py            #   Settings (env-driven)
│   │   ├── security.py          #   scrypt password hashing (stdlib)
│   │   ├── seed.py              #   `make seed` demo data
│   │   └── persistence/         #   db.py, models.py, repositories.py, uow.py
│   └── presentation/            # LAYER 3 — HTTP
│       ├── routers/             #   auth.py, groups.py (groups, expenses, balances)
│       ├── schemas/api.py       #   Pydantic request/response models
│       ├── deps.py              #   unit of work per request, session cookie → current user
│       └── error_handlers.py    #   DomainError → HTTP responses
└── tests/
    ├── fakes.py                 #   in-memory UnitOfWork + fast hasher
    ├── unit/                    #   domain + use cases (no HTTP, no DB)
    ├── api/                     #   FastAPI TestClient end-to-end on the fakes
    └── integration/             #   real PostgreSQL (`<POSTGRES_DB>_test`), skipped if down
```

### 3.2 The dependency rule (HARD RULE)

Imports may only point **inward**. Violations must be rejected in review.

| Layer | May import from | Must NEVER import |
|---|---|---|
| `domain` | Python stdlib only | FastAPI, Pydantic, SQLAlchemy, any other layer |
| `application` | `domain` | FastAPI, Pydantic, infrastructure |
| `infrastructure` | `domain`, `application` (to implement ports) | presentation |
| `presentation` | `application` (use cases, DTOs), Pydantic, FastAPI | infrastructure internals, SQL |
| `main.py` | everything (wiring only) | — |

- **Domain entities are plain dataclasses** — no Pydantic in `domain/`.
- Pydantic models exist **only** in `presentation/schemas/` as request/response shapes.
- Use cases never see `Request`/`Response`/headers — they receive plain values (e.g. `payer: str`, `amount: str`).
- Repositories are `Protocol`s defined in `application/ports.py`; use cases depend on the protocol; `infrastructure/` implements it; `main.py`/`deps.py` injects the concrete one.
- Storage: **PostgreSQL 16** in docker-compose, accessed with async SQLAlchemy 2 + psycopg 3
  (`infrastructure/persistence/db.py`). Repositories still go through ports in `application/ports.py`;
  unit tests use fakes, no database needed.

---

## 4. Business Rules (from the API spec)

### 4.1 Money — HARD RULES

- Money is **never** a `float`. Internally compute in **integer cents** (satang).
- Money enters and leaves the API as **strings**: `"1000.00"`, `"333.33"`.
- Validate at the boundary: parse string → `Decimal` → quantize to 2 dp → int cents. Reject anything else with `400`.
- Serialization is always `f"{cents // 100}.{cents % 100:02d}"` style output (string, 2 dp).

### 4.2 Equal split

- Amount is split into equal shares in **integer cents**; leftover cents are distributed **one cent at a time to members in the order they appear in the `members` list**.
- Golden example (MUST pass as a test):
  `1000.00` among `["alice", "bob", "carol"]` → alice `333.34`, bob `333.33`, carol `333.33` (sum = `1000.00`).

### 4.3 Exact split

- `"split": {"type": "exact", "shares": {"alice": "500.00", ...}}` — shares must be for existing members only and must **sum exactly to the expense amount**, otherwise `400`.
- No auto-rounding for exact splits; validate in integer cents.

### 4.4 Balances

- `balance(member) = Σ amounts of expenses they paid − Σ their shares across all expenses`.
- Positive = money owed **to** that member; negative = money they owe.
- Invariant: **balances across all members always sum to `0.00`**. Enforce with a test on the golden example:
  alice `+666.66`, bob `−333.33`, carol `−333.33` → sum `0.00`.

### 4.5 Authentication — accounts and session cookie

*(Replaced the plain `X-User` header on 2026-11-14, approved by the user.)*

- `POST /auth/register` / `POST /auth/login` take `{"username", "password"}` and set the session
  cookie `sb_session` (`HttpOnly; SameSite=Lax; Path=/`, `Secure` when `SESSION_COOKIE_SECURE=true`,
  lifetime `SESSION_TTL_HOURS`, default 168). `POST /auth/logout` deletes the session; `GET /auth/me`
  returns the signed-in user.
- Username: 3–32 chars of `[a-z0-9._-]`; taken → `409`. Password: 8–128 chars.
- Passwords are hashed with stdlib scrypt (n=2^15, r=8, p=1, 16-byte salt) in
  `infrastructure/security.py`. Session tokens are 32 random bytes; only their SHA-256 is stored.
- Wrong password and unknown user give the same `401 "Incorrect username or password."` and take
  the same time.
- Identity comes **only** from the session — never from a header, body, query or path.
- No session → `401`; acting on a group the user is not a member of → `403` (unknown group → `404`).

### 4.6 Idempotency — `Idempotency-Key` header

- `POST /groups/{group_id}/expenses` **requires** `Idempotency-Key`; missing → `400`.
- Scope: per `(group_id, key)`.
- Same key resent (regardless of retry count) → return the **original response** (same status + body), never create a duplicate expense.
- Same key but a **different request body** → `409 Conflict`.
- Store responses in the idempotency store (`infrastructure/idempotency.py`), not in the expense repository itself.

### 4.7 Permissions

- Editing (`PUT`) or deleting an expense is allowed **only for its current payer**; anyone else
  (even a member) → `403`. An edit follows every create rule; the new payer may be any member.
- Listing groups returns only groups containing the requesting user.

### 4.8 Groups, owners and invites (added 2026-11-14, approved by the user)

- Any signed-in user can create a group; they become its **owner** and first member.
- Only the owner can rename it, reset its invite code, remove other members, or delete it
  (deleting removes every bill and idempotency key with it). Others → `403`.
- Every group has an **invite code** (12 URL-safe random chars). Members see it and share it as
  `/join/<code>`. A signed-in user who opens it can preview and join; joining twice is a no-op.
  Resetting the code makes old links return `404`. New members are appended to the member order.
- A member may **leave** (remove themself). The owner cannot leave → `409` (delete instead).
- Leaving or being removed requires a **balance of exactly 0.00**, otherwise `409`, so balances
  always keep summing to zero.

---

## 5. API Contract

| Method | Path | Description | Success |
|---|---|---|---|
| POST | `/auth/register` | Create an account and sign in (sets cookie) | `201` |
| POST | `/auth/login` | Sign in (sets cookie) | `200` |
| POST | `/auth/logout` | Sign out (clears cookie) | `204` |
| GET | `/auth/me` | The signed-in user | `200` |
| GET | `/groups` | Groups of the requesting user | `200` |
| POST | `/groups` | Create a group (`{"name"}`); caller becomes owner | `201` |
| GET | `/groups/{group_id}` | Group with members, owner, invite code | `200` |
| PATCH | `/groups/{group_id}` | Rename (`{"name"}`) — owner only | `200` |
| DELETE | `/groups/{group_id}` | Delete group and its bills — owner only | `204` |
| POST | `/groups/{group_id}/invite/reset` | New invite code — owner only | `200` |
| DELETE | `/groups/{group_id}/members/{username}` | Remove a member (owner) or leave (self); settled only | `204` |
| GET | `/invites/{code}` | Preview a group from its invite code | `200` |
| POST | `/invites/{code}/join` | Join the group (idempotent) | `200` |
| POST | `/groups/{group_id}/expenses` | Record a new expense (requires `Idempotency-Key`) | `201` |
| GET | `/groups/{group_id}/expenses` | Expenses, reverse chronological (newest first; tie-break: newest id) | `200` |
| PUT | `/groups/{group_id}/expenses/{expense_id}` | Replace an expense — payer only | `200` |
| DELETE | `/groups/{group_id}/expenses/{expense_id}` | Delete expense — payer only | `204` |
| GET | `/groups/{group_id}/balances` | Net balance per member (positive = owed to member) | `200` |

Response shapes: groups `{"id", "name", "members": [...], "owner", "invite_code"}` (member order
is meaningful); invite preview `{"group_id", "name", "owner", "member_count", "already_member"}`;
expenses `{"id", "description", "paid_by", "amount", "split": {"type", "members"|"shares"},
"shares": {member: amount}, "created_at"}`; balances `[{"member", "balance"}]` in member order.
`make seed` adds demo groups; users create their own with `POST /groups`.

Example request (golden case):

```http
POST /groups/1/expenses
Cookie: sb_session=…
Idempotency-Key: 7f3c2a10-dinner-0001

{
  "description": "Dinner at the night market",
  "paid_by": "alice",
  "amount": "1000.00",
  "split": { "type": "equal", "members": ["alice", "bob", "carol"] }
}
```

---

## 6. Error Handling

- Domain errors (`domain/errors.py`) are raised by use cases; `presentation/error_handlers.py` maps them to HTTP. Routers never raise `HTTPException` for business rules directly.
- Mapping: malformed request schema (bad body/params) → `422`, business-rule violation → `400`,
  no session / wrong credentials → `401`, missing `Idempotency-Key` → `400`, not a member / not
  payer / not owner → `403`, unknown group/expense/invite → `404`, idempotency conflict /
  username taken / unsettled balance / owner leaving → `409`.
- Implemented in `app/presentation/error_handlers.py`: `RequestValidationError` → flattened
  `422 {"detail": "<message>"}`; unhandled exceptions → `500 {"detail": "Internal server error"}`
  with details only in server logs.
- Error body shape (consistent everywhere): `{"detail": "<human-readable message>"}`.

---

## 7. Code Style

- Type hints on every function signature (params and return).
- `ruff` is the formatter and linter (line length 100); run `uv run ruff format . && uv run ruff check .`
  before finishing any change.
- TypeScript (frontend repo) is formatted/linted with ESLint — out of backend scope, see frontend rules.
- Naming: `snake_case` functions/vars, `PascalCase` classes, `UPPER_SNAKE` constants.
- Business logic lives in `domain/` and `application/use_cases/` — **never in routers**.
- A router does exactly three things: parse/validate input → call one use case → return the mapped response.
- No wildcard imports; no `print()` (use `logging` if needed).
- Add dependencies only when genuinely needed; justify each one.

---

## 8. Testing Rules

- Framework: `pytest` (+ FastAPI `TestClient` for API tests).
- `tests/unit/` — domain services and use cases with fake/in-memory repositories. **Required cases:**
  - equal-split remainder distribution (golden example above),
  - exact-split sum mismatch → error,
  - balances sum-to-zero invariant,
  - idempotent replay returns the original response,
  - non-payer delete rejected.
- `tests/api/` — end-to-end through the HTTP layer, covering every endpoint incl. auth failures (401/403/404).
- `tests/integration/` — the same flow on real PostgreSQL (migrations, constraints, the
  idempotency unique-key race). Uses `<POSTGRES_DB>_test`, rebuilt each run; skipped when the
  database is down.
- A change is not done until `uv run pytest` passes.

---

## 9. Workflow Rules for AI Assistants

1. Read this file before every task; follow it even if the user's prompt is brief.
2. New endpoint checklist: router → schema → use case → port method → repository impl → wiring in `deps.py`/`main.py` → tests → update §5 if the contract changed.
3. Keep layers honest: if you feel the need to import FastAPI inside `domain/`, redesign instead.
4. Never store money as float, never round with `round()` — use integer cents.
5. Do not skip tests. Do not mark a task complete with failing or untested code.
6. If a requirement is ambiguous (e.g. where leftover cents go), prefer what is written here; propose a change to this file rather than silently deciding.
