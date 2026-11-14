# SplitBill API — uv-based image (AI_NOTES.md §2). Secrets never enter the image (.dockerignore).
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies first so this layer caches between code changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Application code.
COPY app ./app

# Run as an unprivileged user (SECURITY_RULES.md).
RUN groupadd --system app && useradd --system --gid app --home-dir /app --no-create-home app
USER app

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
