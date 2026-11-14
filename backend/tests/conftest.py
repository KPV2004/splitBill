"""Shared test setup. Settings are built at import time, so give them fake values when
there is no local .env (CI). Real credentials are never needed by unit or API tests."""

import os
from pathlib import Path

if not (Path(__file__).resolve().parent.parent / ".env").exists():
    for key, value in {
        "POSTGRES_USER": "test",
        "POSTGRES_PASSWORD": "test-only-not-a-secret",
        "POSTGRES_DB": "test",
    }.items():
        os.environ.setdefault(key, value)
