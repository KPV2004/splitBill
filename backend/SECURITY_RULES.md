# SECURITY_RULES.md — Security Action Control for SplitBill Backend

This file **controls what actions may be taken** in this repository by AI assistants and developers.
It works together with [AI_NOTES.md](AI_NOTES.md) (architecture & business rules). Where the two files differ on
security, **this file wins**.

Read this file before every task. Security is never traded away for speed, simplicity, or "just for testing".

---

## 1. Action Levels

Every action below is classified:

| Level | Meaning |
|---|---|
| 🟢 **ALLOWED** | Proceed without asking. |
| 🟡 **CONFIRM** | Explain what will happen and **get explicit user approval first**. |
| 🔴 **FORBIDDEN** | Never do it. Refuse and propose a safe alternative. |

If an action is not listed, classify it by risk: anything destructive, outward-facing, or touching
credentials → treat as 🟡 CONFIRM at minimum.

---

## 2. Action Control Table

### 2.1 Files & code

| Action | Level |
|---|---|
| Read files inside this project | 🟢 ALLOWED |
| Create/edit files under `app/`, `tests/` | 🟢 ALLOWED |
| Edit `AI_NOTES.md` / `SECURITY_RULES.md` | 🟡 CONFIRM (user decides policy) |
| Delete any file | 🟡 CONFIRM |
| Overwrite `.venv/`, `uv.lock`, `pyproject.toml` wholesale | 🟡 CONFIRM |
| Delete `.git`, `pyproject.toml`, or lockfiles | 🔴 FORBIDDEN |
| Modify code to disable, skip, or weaken auth / validation / permission checks "temporarily" | 🔴 FORBIDDEN (no exceptions — not for demos, not for debugging) |
| Add a backdoor, hard-coded credential, or "magic" bypass | 🔴 FORBIDDEN |

### 2.2 Commands & execution

| Action | Level |
|---|---|
| `uv run pytest`, `uv run ruff` | 🟢 ALLOWED |
| Start dev server on `127.0.0.1` | 🟢 ALLOWED |
| Bind server to `0.0.0.0` / expose beyond localhost | 🟡 CONFIRM |
| Install packages (`uv add ...`) | 🟡 CONFIRM (justify each dependency) |
| Run a script downloaded from the internet | 🟡 CONFIRM |
| `rm -rf`, `git reset --hard`, `git push --force`, `DROP TABLE`-class actions | 🔴 FORBIDDEN unless the user explicitly asks in their own words |
| pip / pip install into the venv directly | 🔴 FORBIDDEN (uv only, per AI_NOTES §2) |

### 2.3 Network & data flow

| Action | Level |
|---|---|
| Call external APIs with project data | 🟡 CONFIRM (sending data out = publishing it) |
| Deploy / publish / share a public URL | 🟡 CONFIRM |
| Send logs, payloads, or code to third-party services for debugging | 🔴 FORBIDDEN |

### 2.4 Secrets & credentials

| Action | Level |
|---|---|
| Read `.env` values to use in local config | 🟢 ALLOWED |
| Hard-code any secret, token, or password in source code, docker-compose fallbacks, or any committed file | 🔴 FORBIDDEN |
| Commit or print `.env` contents | 🔴 FORBIDDEN |
| Put secrets in logs, error messages, or test fixtures | 🔴 FORBIDDEN |
| Commit a leaked secret "because it is just a demo" | 🔴 FORBIDDEN |

---

## 3. Application Security Rules (code level)

### 3.1 Identity & authorization — HARD RULES

- Identity comes **only** from the `X-User` header. Never accept the caller's identity from a request
  body, query param, or path — body fields like `paid_by` describe *data*, not *the caller*.
- Every group-scoped endpoint MUST verify: user header present → `401`; group exists → `404`; user is a
  member → `403`. Order matters, per AI_NOTES §6.
- Permission checks live in use cases (application layer), not only in routers — a new entry point
  (CLI, background job) must not accidentally bypass them.
- New endpoints default to **authenticated + membership-checked**. Open access must be an explicit,
  documented decision in AI_NOTES §5.

### 3.2 Input validation

- Validate at the boundary with Pydantic (strict types). Reject: negative or zero amounts, non-2-decimal
  strings, unknown split types, unknown members, oversized strings (e.g. `description` ≤ 200 chars,
  amount ≤ `99999999.99` THB), missing `X-User` / `Idempotency-Key` where required.
- Never pass raw request objects into the domain or application layers.
- Reject unknown fields rather than silently ignoring them (`model_config = ConfigDict(extra="forbid")`).

### 3.3 Injection & dangerous APIs — HARD RULES

- No `eval()`, `exec()`, `pickle`, `yaml.load` (unsafe), `subprocess` with `shell=True`.
- When a database is introduced: **parameterized queries only** (SQLAlchemy / query builders); never
  build SQL by string concatenation or f-strings, ever — even for "just a quick filter".
- Store only JSON-safe, validated data in the in-memory stores; keys (`group_id`, `Idempotency-Key`) are
  treated as untrusted input — validate type/format before using them as dict keys.

### 3.4 Error handling & information leakage

- Never return stack traces, file paths, SQL, or internal exception text in responses. Unexpected errors →
  generic `500 {"detail": "Internal server error"}` + full detail only in server logs.
- 401 vs 404 vs 403 exactly as mapped in AI_NOTES §6 — do not "helpfully" reveal why access failed beyond that.
- Logs may contain user-facing identifiers (group id, username) but never secrets or full payloads.

### 3.5 CORS & headers

- CORS origins: an explicit allowlist (e.g. the local frontend dev origin). `allow_origins=["*"]` with
  credentials is 🔴 FORBIDDEN. Wildcard CORS requires 🟡 CONFIRM even without credentials.
- Keep default FastAPI docs (`/docs`) enabled locally; when deploying beyond localhost, confirm with the
  user whether to disable them (🟡 CONFIRM).

### 3.6 Secrets management

- Secrets live in `.env` (git-ignored), loaded via `pydantic-settings`. `.env` must be in `.gitignore`
  **before** the first commit; `.env.example` with dummy values is the committed template.
- No real credentials in test fixtures — tests use fake values.
- Docker Compose dev defaults (e.g. the `POSTGRES_PASSWORD` fallback) are for this machine only;
  anything exposed beyond localhost must set real values via `.env` (exposing = 🟡 CONFIRM).
- If a secret is ever exposed (committed, printed, sent to a log): stop, tell the user immediately,
  and the secret must be **rotated**, not deleted.

---

## 4. Dependency Policy

- Each new dependency needs justification (🟡 CONFIRM): what it does, why stdlib/FastAPI can't do it.
- Prefer well-known, actively maintained packages; pin via `uv add` so `uv.lock` records it.
- Never vendor or inline code copied from the internet without saying where it came from.
- Never add packages that obscure review (minifiers, obfuscators, "tiny helper" pastebins, etc.).

---

## 5. Pre-Completion Security Checklist

A task is not "done" until all of these hold:

1. No secret, token, or credential in code, tests, logs, or the response to the user.
2. Auth and permission checks are in place for every new/changed endpoint (401/403/404 path included in tests).
3. All inputs validated at the boundary; money still string→cents→string (AI_NOTES §4.1).
4. No new dependency was added without the user's confirmation.
5. `uv run pytest` and `uv run ruff check .` pass.
6. `.env` untouched by git; `.gitignore` still covers it.

---

## 6. Incident Response

If you (the AI) realize a security mistake was made during a task — leaked secret, weakened auth,
wrong 401/403 behavior, data sent somewhere external:

1. **Stop** the current action — do not try to quietly "fix it along the way".
2. **Report plainly** what happened, what was exposed, and to whom/where.
3. **Propose the fix** (usually: rotate the secret, restore the check, revert the commit) and wait for the user.
4. Never delete evidence (commits, logs) to hide the mistake.
