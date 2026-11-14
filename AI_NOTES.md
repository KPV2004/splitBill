# AI_NOTES.md — SplitBill (whole project)

Project-wide map and development plan for humans and AI assistants. Read this first, then the
side-specific rules:

- **Backend rules (source of truth for API + business rules):** [backend/AI_NOTES.md](backend/AI_NOTES.md)
- **Backend security policy (wins on security matters):** [backend/SECURITY_RULES.md](backend/SECURITY_RULES.md)
- **Frontend agent rules:** [frontend/AGENTS.md](frontend/AGENTS.md) — Next.js 16 has breaking
  changes; read `frontend/node_modules/next/dist/docs/` before writing Next-specific code.

If this file and `backend/AI_NOTES.md` disagree on the API contract or money rules, the backend
file wins and this file must be corrected.

_Last reviewed: 2026-11-14._

---

## 1. What SplitBill is

A split-bill app for groups, in **THB, always 2 decimals**. A user (identified by the `X-User`
header) sees their groups, records expenses split **equally** or by **exact amounts**, deletes
their own expenses, and sees per-member **balances** that always sum to `0.00`.

```
splitBill/
├── AI_NOTES.md          ← this file
├── backend/             FastAPI + PostgreSQL 16 (clean architecture, uv, Alembic)
└── frontend/            Next.js 16 + React 19 + Tailwind 4 single-page client
```

Neither folder is a git repository yet (nor is the root) — see Phase 0.

---

## 2. Current state (as of 2026-11-14)

### 2.1 Backend — API implemented (branch `feature/backend-api`)

| Area | Status |
|---|---|
| Tooling: uv, Ruff, pytest, Docker Compose, Makefile (`make seed` added) | ✅ |
| Domain: money (satang), equal/exact splits, balances, errors | ✅ |
| Application: Auth/Group/Expense services, ports, unit of work, idempotency incl. race | ✅ |
| Persistence: migration `0002` (users, sessions, groups, members, expenses, shares, idempotency keys), SQLAlchemy repos | ✅ |
| HTTP: `/auth/*`, `/groups…` per §4, error mapping, CORS allowlist | ✅ |
| Auth: accounts + HttpOnly session cookie (stdlib scrypt); `X-User` removed | ✅ |
| Tests: 51 (unit, HTTP on fakes, real-Postgres integration) | ✅ pass |
| Verified with the redesigned frontend in a browser against the real API | ✅ |
| Create-group / membership endpoints | ❌ not yet (households come from `make seed`) |

### 2.2 Frontend — redesigned, with login/register, against a mock

Branch `feature/auth-and-redesign`. Design record: `frontend/PRODUCT.md`,
`frontend/.impeccable/surfaces/app-page-tsx.md` (the "Pinto" direction).

| Area | Status |
|---|---|
| `/login`, `/register` (`components/AuthScreen.tsx`) — validation mirrors backend rules | ✅ |
| `/` household ledger (`app/page.tsx`): green household rail, balances, bills, new-bill panel | ✅ |
| Thai / English switch (`lib/i18n.tsx`), saved per browser | ✅ |
| Session state (`lib/auth.tsx`) — HttpOnly cookie, `GET /auth/me` on load, 401 → back to login | ✅ |
| `lib/api.ts` — cookie auth (no `X-User`), `Idempotency-Key`, tolerant normalizers | ✅ |
| `lib/money.ts`, `lib/split.ts` — integer satang, live equal/exact preview | ✅ |
| `scripts/mock-backend.mjs` — full contract **plus auth** on :9999, demo bills seeded | ✅ |
| Tests: Vitest on `lib/` only (no component tests) | ✅ 41 pass |
| Dark theme | ❌ not in scope yet |

---

## 3. Known bugs (fix before anything else)

1. ~~`frontend/lib/split.ts` used `formatCents` without importing it~~ — fixed on
   `feature/auth-and-redesign` (now `serializeCents`).
2. ~~Amounts ≥ 1,000 sent as `"1,000.00"`~~ — fixed; the form sends `serializeCents` output, with a
   regression test.
3. ~~Idempotency key regenerated per click~~ — fixed; one key per draft, reused on retry, rotated
   after success or when the payload changes (`components/ExpenseForm.tsx`).
4. ~~Deprecated 422 constant~~ — fixed (`HTTP_422_UNPROCESSABLE_CONTENT`).
5. ~~`make db-shell` hard-coded credentials~~ — fixed; reads the container's env.
6. ~~Tests needed a `.env`~~ — fixed; `tests/conftest.py` supplies fake values when there is none.

---

## 4. The contract both sides must agree on

### 4.1 Auth (implemented in backend, frontend and mock)

> Approved by the user on 2026-11-14 and recorded in `backend/AI_NOTES.md §4.5`, which is the
> source of truth.

| Endpoint | Body | Success | Errors |
|---|---|---|---|
| `POST /auth/register` | `{ "username", "password" }` | `201 { "username" }` + session cookie | `400` invalid username/password, `409` taken |
| `POST /auth/login` | `{ "username", "password" }` | `200 { "username" }` + session cookie | `401 "Incorrect username or password."` |
| `POST /auth/logout` | — | `204`, cookie cleared | — |
| `GET /auth/me` | — | `200 { "username" }` | `401` no valid session |

- Session cookie: `sb_session`, `HttpOnly; SameSite=Lax; Path=/`, 7 days. JavaScript never sees
  it; the Next `/api/*` rewrite forwards `Cookie` and `Set-Cookie` unchanged (verified).
- Username: 3–32 chars, `[a-z0-9._-]`. Password: 8–128 chars, stored hashed with scrypt
  (stdlib in the backend — no extra dependency).
- Every group endpoint takes identity from the session; no session → `401`. The same 401 → 404 → 403
  order applies.
- Demo accounts: `alice`, `bob`, `carol`, `dave`. Mock password `splitbill123`; the backend uses
  whatever `SEED_DEMO_PASSWORD` is set to when you run `make seed`.

### 4.2 Groups, expenses, balances

Full spec: [backend/AI_NOTES.md §4–§6](backend/AI_NOTES.md). What the frontend actually
consumes (and what `mock-backend.mjs` returns) — the backend should pin these exact shapes:

| Endpoint | Response the frontend expects |
|---|---|
| `GET /groups` | `[{ "id": 1, "name": "Bangkok Trip", "members": ["alice", …] }]` (members optional) |
| `GET /groups/{id}` | `{ "id", "name", "members": [string] }` — member order matters (split order) |
| `GET /groups/{id}/expenses` | `[{ "id", "description", "paid_by", "amount": "1000.00", "split": {…}, "created_at": ISO-8601 }]`, newest first, tie → higher id first |
| `POST /groups/{id}/expenses` | `201`, same expense object (+ optional `"shares": {member: "333.34"}`) |
| `DELETE /groups/{id}/expenses/{eid}` | `204`, payer only |
| `GET /groups/{id}/balances` | `[{ "member": "alice", "balance": "666.66" }]` in group member order |
| Any error | `{ "detail": "<human-readable sentence>" }` — the UI shows `detail` verbatim |

Rules that bite if forgotten:

- **Money:** string in → integer cents → string out (`"-333.33"`), never float, never `round()`.
- **Equal split:** leftover cents go one at a time in the order of the request's `members` list.
  The frontend sends members in **group member order** — keep `GET /groups/{id}` order stable.
- **Auth order:** no session → 401, unknown group → 404, non-member → 403.
- **Idempotency:** per `(group_id, key)`; same key + same body → replay original status/body;
  same key + different body → 409; missing key → 400.
- Write `detail` messages for humans ("The shares do not add up to the total.") — they reach
  users unchanged. Never leak internals (SECURITY_RULES §3.4).

Once the backend pins shapes, the tolerant normalizers in `lib/api.ts` (`asArray`, balance-map
fallback, `raw.username`/`net_balance` aliases) can be tightened.

---

## 5. How to run

```bash
# Backend (needs Docker + uv)
cd backend && cp .env.example .env   # set POSTGRES_PASSWORD
make db && make migrate && make dev  # API on http://127.0.0.1:8000, docs at /docs

# Frontend against the real backend
cd frontend && npm run dev           # http://localhost:3000, /api/* → :8000

# Frontend against the mock (no backend needed)
cd frontend && npm run mock          # :9999
BACKEND_ORIGIN=http://127.0.0.1:9999 npm run dev

# Quality gates
cd backend  && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && npx tsc --noEmit && npm run lint && npm test
```

---

## 6. Development plan

Each phase ends green on the quality gates in §5. Backend work follows the "new endpoint
checklist" in backend/AI_NOTES.md §9: router → schema → use case → port → repo impl → wiring →
tests → docs.

### Phase 0 — Hygiene (½ day)
- [x] `git init` (root as monorepo, or one repo per side — decide), verify `.env` is ignored
      **before** the first commit; commit `.env.example` only.
- [x] Fix bugs §3.1 and §3.2 (`serializeCents` on the wire) + regression test.
- [x] Backend `tests/conftest.py` with fake env vars; fix the 422 constant deprecation.
- [ ] Add a CI workflow running both sides' quality gates.

### Phase 1 — Backend domain core (no DB, no HTTP)
- [x] `domain/value_objects/money.py`: `Money` (int cents), `parse("1000.00")` / `to_str()`,
      rejecting floats, >2 dp, ≤0, > 99,999,999.99.
- [x] `domain/value_objects/split.py`: `EqualSplit(members)`, `ExactSplit(shares)`.
- [x] `domain/services/`: `SplitCalculator` (remainder by list order), `BalanceCalculator`.
- [x] `domain/entities/`: `Group`, `Member`, `Expense` dataclasses; `domain/errors.py`.
- [x] `tests/unit/`: golden equal split, exact mismatch, balances sum to zero, property-style
      test (random amounts/member counts → shares sum to total).

### Phase 2 — Application layer
- [x] `application/ports.py`: `GroupRepository`, `ExpenseRepository`, `IdempotencyStore` Protocols.
- [x] Use cases: `ListGroups`, `GetGroup`, `CreateExpense`, `ListExpenses`, `DeleteExpense`,
      `GetBalances` — membership and payer checks live **here** (SECURITY_RULES §3.1).
- [x] Unit tests with in-memory fakes: non-member 403, non-payer delete, idempotent replay, 409.

### Phase 3 — Persistence
- [x] SQLAlchemy models + Alembic revision `0002`: `users`, `groups`, `group_members`
      (with `position` to keep member order), `expenses` (amount_cents BIGINT, payer, created_at),
      `expense_shares` (expense_id, member, cents), `idempotency_keys`
      (group_id, key, request_hash, status, response_body; UNIQUE(group_id, key)).
- [x] Seed migration (or `make seed`) with the demo data the frontend uses: Bangkok Trip
      (alice, bob, carol), Office Lunch (alice, bob), Chiang Mai 2026 (bob, carol, dave).
      The contract has no "create group" endpoint, so groups must come from seeds.
- [x] Repository implementations; set `target_metadata` in `migrations/env.py`.
- [x] Store computed shares at write time so balances never depend on re-running split logic.
- [x] Create expense + idempotency record in **one transaction**; handle concurrent same-key
      requests via the unique constraint (loser re-reads and replays).

### Phase 4 — HTTP layer
- [x] `presentation/schemas/` (Pydantic, `extra="forbid"`, money as `str`), `deps.py`
      (`X-User` → 401, `Idempotency-Key` → 400), routers for every §4 endpoint.
- [x] Map `DomainError` subclasses → 400/403/404/409 in `error_handlers.py`.
- [x] CORS middleware from `CORS_ORIGINS` (explicit allowlist; not needed for the Next proxy,
      but needed for direct browser access).
- [x] `tests/api/` for every endpoint incl. 401/403/404/409, golden example end to end.
- [x] Update backend README status + this file's §2.

### Phase 5 — Integration
- [x] Run the frontend against the real backend; reconcile any shape differences with §4.
- [ ] Contract test: run one scenario script against both `mock-backend.mjs` and the real API
      and diff the responses, so the mock can't silently drift.
- [ ] Tighten `lib/api.ts` normalizers to the pinned shapes.
- [x] Fix idempotency-key-per-draft (bug §3.3).

### Phase 6 — Frontend quality
- [ ] Component tests (Vitest + Testing Library, jsdom) for `ExpenseForm` (submit disabled until
      exact split balances; payload format) and `ExpenseList` (payer-only delete).
- [ ] Split `page.tsx` state into a hook (`useGroupData`) — it holds ~15 `useState`s.
- [ ] Persist the active user/group in the URL (`?user=alice&group=1`) so reloads keep context.
- [x] Replace the root `README.md` boilerplate with real run instructions.
- [ ] Accessibility pass (focus after submit/delete, keyboard flow through split options).

### Phase 7 — Product features (beyond the current contract; update backend/AI_NOTES.md first)
- [ ] "Who pays whom" settlement suggestions (min-transfers from balances; pure frontend or a
      `GET /groups/{id}/settlements` endpoint).
- [ ] Record a settlement/payment as a special expense type.
- [ ] Group creation & member management endpoints + UI.
- [ ] Edit expense; pagination for long expense lists.
- [x] Backend auth per §4.1 (users table, scrypt hashing, session cookie), replacing `X-User`.

### Phase 8 — Deployment (all 🟡 CONFIRM)
- [ ] Production compose / hosting; real secrets via env; decide whether `/docs` stays public.
- [ ] Frontend `BACKEND_ORIGIN` pointing at the deployed API.

---

## 7. Rules of thumb for AI assistants

1. Never put money in a float on either side. Display with `formatCents`, send with
   `serializeCents`.
2. Don't edit `backend/AI_NOTES.md` or `backend/SECURITY_RULES.md` without the user's approval.
3. Backend: uv only (no pip), schema only via Alembic, no secrets in code, layers import inward only.
4. Frontend: read Next 16 docs in `node_modules/next/dist/docs/` before using Next APIs; keep
   `lib/money.ts` / `lib/split.ts` in lockstep with backend split rules and their tests.
5. When the API contract changes, update `backend/AI_NOTES.md §5`, this file's §4, `lib/api.ts`,
   and `scripts/mock-backend.mjs` together.
6. A task is done only when the §5 quality gates pass on the side(s) you touched.
