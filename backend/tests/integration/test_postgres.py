"""Against real PostgreSQL: migrations, repositories, constraints and the idempotency
race, through the HTTP layer. Uses a separate `<POSTGRES_DB>_test` database (created on
demand, rebuilt each run); skipped when the database is unreachable (`make db` first)."""

import asyncio
from collections.abc import AsyncIterator, Iterator

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.application.dto import IdempotencyRecord
from app.application.ports import IdempotencyRaceError
from app.infrastructure.config import settings
from app.infrastructure.persistence.uow import SqlUnitOfWork
from app.infrastructure.security import hash_password, verify_password
from app.main import app
from app.presentation.deps import get_uow

TEST_DB = f"{settings.postgres_db}_test"
TEST_URL = settings.database_url.rsplit("/", 1)[0] + f"/{TEST_DB}"
PASSWORD = "integration-pw"  # test fixture only; never a real credential


def _admin_connect() -> psycopg.Connection:
    return psycopg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        user=settings.postgres_user,
        password=settings.postgres_password,
        dbname="postgres",
        autocommit=True,
        connect_timeout=3,
    )


@pytest.fixture(scope="module")
def migrated() -> Iterator[None]:
    try:
        with _admin_connect() as admin:
            # Identifier from our own settings, quoted; never user input.
            admin.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)')
            admin.execute(f'CREATE DATABASE "{TEST_DB}"')
    except psycopg.OperationalError:
        pytest.skip("PostgreSQL is not reachable — run `make db` to include these tests.")
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", TEST_URL)
    command.upgrade(config, "head")
    yield


@pytest.fixture
def client(migrated: None) -> Iterator[TestClient]:
    engine = create_async_engine(TEST_URL, poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def reset() -> None:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "TRUNCATE idempotency_keys, expense_shares, expenses, group_members, "
                    "groups, sessions, users RESTART IDENTITY CASCADE"
                )
            )
            pw = hash_password(PASSWORD)
            for name in ("alice", "bob", "carol", "dave"):
                await conn.execute(
                    text("INSERT INTO users (username, password_hash) VALUES (:u, :p)"),
                    {"u": name, "p": pw},
                )
            await conn.execute(text("INSERT INTO groups (name) VALUES ('Ari Condo 12A')"))
            for position, name in enumerate(("alice", "bob", "carol")):
                await conn.execute(
                    text("INSERT INTO group_members VALUES (1, :u, :p)"),
                    {"u": name, "p": position},
                )

    asyncio.run(reset())

    async def uow() -> AsyncIterator[SqlUnitOfWork]:
        async with sessions() as session:
            yield SqlUnitOfWork(session)

    app.dependency_overrides[get_uow] = uow
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def login(client: TestClient, name: str) -> None:
    response = client.post("/auth/login", json={"username": name, "password": PASSWORD})
    assert response.status_code == 200, response.text


DINNER = {
    "description": "Dinner at the night market",
    "paid_by": "alice",
    "amount": "1000.00",
    "split": {"type": "equal", "members": ["alice", "bob", "carol"]},
}


def test_scrypt_round_trip() -> None:
    stored = hash_password("correct horse")
    assert stored.startswith("scrypt$")
    assert verify_password("correct horse", stored)
    assert not verify_password("wrong horse", stored)
    assert not verify_password("anything", "not-a-hash")


def test_full_flow_on_postgres(client: TestClient) -> None:
    registered = client.post("/auth/register", json={"username": "erin", "password": "long-enough"})
    assert registered.status_code == 201
    assert client.get("/auth/me").json() == {"username": "erin"}
    assert client.get("/groups").json() == []
    duplicate = client.post("/auth/register", json={"username": "erin", "password": "long-enough"})
    assert duplicate.status_code == 409

    login(client, "alice")
    headers = {"Idempotency-Key": "dinner-1"}
    created = client.post("/groups/1/expenses", json=DINNER, headers=headers)
    assert created.status_code == 201, created.text
    replay = client.post("/groups/1/expenses", json=DINNER, headers=headers)
    assert replay.json() == created.json()
    conflict = client.post("/groups/1/expenses", json={**DINNER, "amount": "1.00"}, headers=headers)
    assert conflict.status_code == 409

    rent = {
        **DINNER,
        "description": "Rent",
        "amount": "18000.00",
        "split": {
            "type": "exact",
            "shares": {"carol": "5500.00", "alice": "7000.00", "bob": "5500.00"},
        },
    }
    client.post("/groups/1/expenses", json=rent, headers={"Idempotency-Key": "rent-1"})
    listed = client.get("/groups/1/expenses").json()
    assert [e["description"] for e in listed] == ["Rent", "Dinner at the night market"]
    assert list(listed[0]["split"]["shares"]) == ["carol", "alice", "bob"]  # order kept

    balances = client.get("/groups/1/balances").json()
    assert balances == [
        {"member": "alice", "balance": "11666.66"},
        {"member": "bob", "balance": "-5833.33"},
        {"member": "carol", "balance": "-5833.33"},
    ]

    expense_id = created.json()["id"]
    login(client, "bob")
    assert client.delete(f"/groups/1/expenses/{expense_id}").status_code == 403
    login(client, "alice")
    assert client.delete(f"/groups/1/expenses/{expense_id}").status_code == 204
    # The original answer is still replayed after the expense is gone.
    assert client.post("/groups/1/expenses", json=DINNER, headers=headers).status_code == 201

    assert client.post("/auth/logout").status_code == 204
    assert client.get("/groups").status_code == 401


def test_idempotency_unique_constraint_raises_race(client: TestClient) -> None:
    login(client, "alice")
    created = client.post("/groups/1/expenses", json=DINNER, headers={"Idempotency-Key": "k"})
    assert created.status_code == 201

    async def store_again() -> None:
        engine = create_async_engine(TEST_URL, poolclass=NullPool)
        async with async_sessionmaker(engine)() as session:
            uow = SqlUnitOfWork(session)
            record = await uow.idempotency.get(1, "k")
            assert record is not None
            with pytest.raises(IdempotencyRaceError):
                await uow.idempotency.add(1, "k", IdempotencyRecord("other", record.expense))
        await engine.dispose()

    asyncio.run(store_again())
