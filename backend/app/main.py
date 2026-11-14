"""FastAPI entry point. Routers will be registered here as use cases land (AI_NOTES.md §3)."""

from fastapi import FastAPI
from sqlalchemy import text

from app.infrastructure.config import settings
from app.infrastructure.persistence.db import SessionLocal
from app.presentation.error_handlers import register_error_handlers

app = FastAPI(title="SplitBill API", version="0.1.0")
register_error_handlers(app)


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
