"""FastAPI entry point — the composition root (AI_NOTES.md §3)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.infrastructure.config import settings
from app.infrastructure.persistence.db import SessionLocal
from app.presentation.error_handlers import register_error_handlers
from app.presentation.routers import auth, groups, invites

app = FastAPI(title="SplitBill API", version="0.2.0")
register_error_handlers(app)

# Explicit allowlist only; credentials allowed so the session cookie works cross-origin
# (SECURITY_RULES.md §3.5). The Next.js frontend uses a same-origin proxy and needs none.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Idempotency-Key"],
)

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(invites.router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Liveness + database probe. Never leaks internal errors (SECURITY_RULES.md §3.4)."""
    database = "up"
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 — a health probe must degrade gracefully, never 500
        database = "down"
    return {
        "status": "ok" if database == "up" else "degraded",
        "database": database,
        "env": settings.app_env,
    }
