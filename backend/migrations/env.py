"""Alembic environment — reads DATABASE_URL from app settings, runs migrations asynchronously."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.infrastructure.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Single source of truth: env vars / .env via Settings — never hardcode URLs here.
config.set_main_option("sqlalchemy.url", settings.database_url)

# No declarative models yet; set to models' MetaData once entities land so
# `alembic revision --autogenerate` can diff against the database.
target_metadata = None


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a DB connection (--sql mode)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
