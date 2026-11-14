"""End to end through the HTTP layer with in-memory repositories (AI_NOTES.md §8):
every endpoint, including 401 / 403 / 404 / 409 and the session cookie."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.presentation.deps import get_hasher, get_uow
from tests.fakes import FakeDatabase, FakeHasher, FakeUnitOfWork, household

DINNER = {
    "description": "Dinner at the night market",
    "paid_by": "alice",
    "amount": "1000.00",
    "split": {"type": "equal", "members": ["alice", "bob", "carol"]},
}


@pytest.fixture
def db() -> Iterator[FakeDatabase]:
    database = FakeDatabase()
    household(database)

    async def fake_uow() -> FakeUnitOfWork:
        return FakeUnitOfWork(database)

    app.dependency_overrides[get_uow] = fake_uow
    app.dependency_overrides[get_hasher] = FakeHasher
    yield database
    app.dependency_overrides.clear()


def signed_in(name: str) -> TestClient:
    client = TestClient(app)
    response = client.post("/auth/login", json={"username": name, "password": f"pw-{name}-123"})
    assert response.status_code == 200, response.text
    return client


def test_register_sets_httponly_cookie_and_me_works(db: FakeDatabase) -> None:
    client = TestClient(app)
    response = client.post("/auth/register", json={"username": "erin", "password": "long-enough"})
    assert response.status_code == 201
    assert response.json() == {"username": "erin"}
    cookie = response.headers["set-cookie"]
    assert "sb_session=" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert client.get("/auth/me").json() == {"username": "erin"}


def test_register_errors(db: FakeDatabase) -> None:
    client = TestClient(app)
    taken = client.post("/auth/register", json={"username": "alice", "password": "long-enough"})
    assert taken.status_code == 409
    assert taken.json() == {"detail": "That username is already taken."}
    assert (
        client.post("/auth/register", json={"username": "e", "password": "x" * 9}).status_code
        == 400
    )
    extra = client.post(
        "/auth/register", json={"username": "erin", "password": "x" * 9, "admin": True}
    )
    assert extra.status_code == 422


def test_login_failure_and_logout(db: FakeDatabase) -> None:
    client = TestClient(app)
    bad = client.post("/auth/login", json={"username": "alice", "password": "nope-nope"})
    assert bad.status_code == 401
    assert bad.json() == {"detail": "Incorrect username or password."}
    client = signed_in("alice")
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_every_group_endpoint_requires_a_session(db: FakeDatabase) -> None:
    client = TestClient(app)
    for method, path in [
        ("get", "/groups"),
        ("get", "/groups/1"),
        ("get", "/groups/1/expenses"),
        ("get", "/groups/1/balances"),
        ("delete", "/groups/1/expenses/1"),
    ]:
        response = getattr(client, method)(path)
        assert response.status_code == 401, path
        assert response.json() == {"detail": "You are not signed in."}
    assert client.post("/groups/1/expenses", json=DINNER).status_code == 401


def test_groups_list_and_detail(db: FakeDatabase) -> None:
    client = signed_in("alice")
    assert client.get("/groups").json() == [
        {"id": 1, "name": "Ari Condo 12A", "members": ["alice", "bob", "carol"]}
    ]
    assert client.get("/groups/1").json()["members"] == ["alice", "bob", "carol"]
    assert client.get("/groups/2").status_code == 403
    assert client.get("/groups/99").status_code == 404


def test_golden_example_end_to_end(db: FakeDatabase) -> None:
    client = signed_in("alice")
    created = client.post("/groups/1/expenses", json=DINNER, headers={"Idempotency-Key": "k1"})
    assert created.status_code == 201
    body = created.json()
    assert body["amount"] == "1000.00"
    assert body["split"] == {"type": "equal", "members": ["alice", "bob", "carol"]}
    assert body["shares"] == {"alice": "333.34", "bob": "333.33", "carol": "333.33"}
    assert body["created_at"]

    balances = signed_in("bob").get("/groups/1/balances").json()
    assert balances == [
        {"member": "alice", "balance": "666.66"},
        {"member": "bob", "balance": "-333.33"},
        {"member": "carol", "balance": "-333.33"},
    ]


def test_idempotency_over_http(db: FakeDatabase) -> None:
    client = signed_in("alice")
    headers = {"Idempotency-Key": "k1"}
    first = client.post("/groups/1/expenses", json=DINNER, headers=headers)
    retry = client.post("/groups/1/expenses", json=DINNER, headers=headers)
    assert retry.status_code == 201 and retry.json() == first.json()
    assert len(client.get("/groups/1/expenses").json()) == 1

    changed = {**DINNER, "amount": "999.00"}
    conflict = client.post("/groups/1/expenses", json=changed, headers=headers)
    assert conflict.status_code == 409
    missing = client.post("/groups/1/expenses", json=DINNER)
    assert missing.status_code == 400
    assert missing.json() == {"detail": "The Idempotency-Key header is required."}


def test_validation_errors(db: FakeDatabase) -> None:
    client = signed_in("alice")

    def post(body: dict, key: str) -> int:
        return client.post(
            "/groups/1/expenses", json=body, headers={"Idempotency-Key": key}
        ).status_code

    assert post({**DINNER, "amount": "1,000.00"}, "a") == 400
    assert post({**DINNER, "amount": "-5"}, "b") == 400
    assert post({**DINNER, "amount": 1000}, "c") == 422  # money must be a string
    exact = {"type": "exact", "shares": {"alice": "500.00", "bob": "300.00"}}
    mismatch = client.post(
        "/groups/1/expenses", json={**DINNER, "split": exact}, headers={"Idempotency-Key": "d"}
    )
    assert mismatch.status_code == 400
    assert mismatch.json() == {"detail": "The shares do not add up to the total."}
    assert post({**DINNER, "split": {"type": "equal", "members": ["dave"]}}, "e") == 400
    assert post({**DINNER, "split": {"type": "thirds"}}, "f") == 422
    assert post({**DINNER, "description": "x" * 201}, "g") == 422
    assert post({**DINNER, "surprise": 1}, "h") == 422


def test_exact_split_and_listing_order(db: FakeDatabase) -> None:
    client = signed_in("alice")
    rent = {
        **DINNER,
        "description": "Rent",
        "amount": "18000.00",
        "split": {
            "type": "exact",
            "shares": {"alice": "7000.00", "bob": "5500.00", "carol": "5500.00"},
        },
    }
    client.post("/groups/1/expenses", json=DINNER, headers={"Idempotency-Key": "k1"})
    second = client.post("/groups/1/expenses", json=rent, headers={"Idempotency-Key": "k2"}).json()
    assert second["split"]["type"] == "exact"
    listed = client.get("/groups/1/expenses").json()
    assert [e["description"] for e in listed] == ["Rent", "Dinner at the night market"]


def test_delete_payer_only(db: FakeDatabase) -> None:
    alice = signed_in("alice")
    expense_id = alice.post(
        "/groups/1/expenses", json=DINNER, headers={"Idempotency-Key": "k1"}
    ).json()["id"]
    bob = signed_in("bob")
    assert bob.delete(f"/groups/1/expenses/{expense_id}").status_code == 403
    assert signed_in("dave").delete(f"/groups/1/expenses/{expense_id}").status_code == 403
    assert alice.delete(f"/groups/1/expenses/{expense_id}").status_code == 204
    assert alice.delete(f"/groups/1/expenses/{expense_id}").status_code == 404
