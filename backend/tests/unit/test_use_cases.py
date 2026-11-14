"""Use cases against in-memory fakes: permissions, idempotency, auth."""

import asyncio
from datetime import timedelta

import pytest

from app.application.dto import IdempotencyRecord
from app.application.use_cases.auth import AuthService
from app.application.use_cases.expenses import CreateExpenseCommand, ExpenseService
from app.application.use_cases.groups import GroupService
from app.domain.errors import (
    GroupNotFoundError,
    IdempotencyConflictError,
    InvalidCredentialsError,
    InviteNotFoundError,
    MissingIdempotencyKeyError,
    NotAuthenticatedError,
    NotMemberError,
    NotOwnerError,
    NotPayerError,
    OwnerCannotLeaveError,
    UnsettledBalanceError,
    UsernameTakenError,
    ValidationError,
)
from tests.fakes import FakeDatabase, FakeHasher, FakeUnitOfWork, household

DINNER = CreateExpenseCommand(
    group_id=1,
    description="Dinner at the night market",
    paid_by="alice",
    amount="1000.00",
    split_type="equal",
    members=("alice", "bob", "carol"),
)


@pytest.fixture
def db() -> FakeDatabase:
    database = FakeDatabase()
    household(database)
    return database


def expenses(db: FakeDatabase) -> ExpenseService:
    return ExpenseService(FakeUnitOfWork(db))


def test_create_then_balances(db: FakeDatabase) -> None:
    view = asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
    assert view.amount == "1000.00"
    assert view.shares == [("alice", "333.34"), ("bob", "333.33"), ("carol", "333.33")]
    balances = asyncio.run(GroupService(FakeUnitOfWork(db)).balances(1, "bob"))
    assert [(b.member, b.balance) for b in balances] == [
        ("alice", "666.66"),
        ("bob", "-333.33"),
        ("carol", "-333.33"),
    ]


def test_idempotent_replay_returns_original(db: FakeDatabase) -> None:
    first = asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
    for _ in range(3):
        again = asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
        assert again == first
    assert len(db.expenses) == 1


def test_same_key_different_body_conflicts(db: FakeDatabase) -> None:
    asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
    changed = CreateExpenseCommand(**{**DINNER.__dict__, "amount": "999.00"})
    with pytest.raises(IdempotencyConflictError):
        asyncio.run(expenses(db).create(changed, "alice", "key-1"))


def test_key_is_scoped_per_group(db: FakeDatabase) -> None:
    asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
    other = CreateExpenseCommand(**{**DINNER.__dict__, "group_id": 2, "paid_by": "bob",
                                    "members": ("bob", "carol")})  # fmt: skip
    asyncio.run(expenses(db).create(other, "bob", "key-1"))
    assert len(db.expenses) == 2


def test_concurrent_same_key_replays_the_winner(db: FakeDatabase) -> None:
    winner = asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
    db.idempotency.clear()
    record = IdempotencyRecord(request_hash=DINNER.fingerprint(), expense=winner)
    racing = ExpenseService(FakeUnitOfWork(db, race_with=record))
    assert asyncio.run(racing.create(DINNER, "alice", "key-1")) == winner
    assert len(db.expenses) == 1  # the loser's insert was rolled back


def test_missing_idempotency_key(db: FakeDatabase) -> None:
    with pytest.raises(MissingIdempotencyKeyError):
        asyncio.run(expenses(db).create(DINNER, "alice", None))


def test_access_rules(db: FakeDatabase) -> None:
    with pytest.raises(GroupNotFoundError):
        asyncio.run(expenses(db).list(99, "alice"))
    with pytest.raises(NotMemberError):
        asyncio.run(expenses(db).list(2, "alice"))
    with pytest.raises(NotMemberError):
        asyncio.run(expenses(db).create(DINNER, "dave", "key-1"))


def test_payer_must_be_member(db: FakeDatabase) -> None:
    bad = CreateExpenseCommand(**{**DINNER.__dict__, "paid_by": "dave"})
    with pytest.raises(ValidationError):
        asyncio.run(expenses(db).create(bad, "alice", "key-1"))


def test_only_payer_can_delete(db: FakeDatabase) -> None:
    view = asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
    with pytest.raises(NotPayerError):
        asyncio.run(expenses(db).delete(1, view.id, "bob"))
    asyncio.run(expenses(db).delete(1, view.id, "alice"))
    assert db.expenses == {}


def test_list_groups_only_mine(db: FakeDatabase) -> None:
    groups = asyncio.run(GroupService(FakeUnitOfWork(db)).list_groups("alice"))
    assert [g.id for g in groups] == [1]


def auth(db: FakeDatabase) -> AuthService:
    return AuthService(
        FakeUnitOfWork(db), FakeHasher(), session_ttl=timedelta(hours=1), clock=lambda: db.clock
    )


def test_register_login_logout(db: FakeDatabase) -> None:
    started = asyncio.run(auth(db).register("erin", "long-enough"))
    assert asyncio.run(auth(db).current_user(started.token)) == "erin"
    assert started.token not in db.sessions  # only the hash is stored
    logged_in = asyncio.run(auth(db).login("erin", "long-enough"))
    asyncio.run(auth(db).logout(logged_in.token))
    with pytest.raises(NotAuthenticatedError):
        asyncio.run(auth(db).current_user(logged_in.token))


def test_register_rules(db: FakeDatabase) -> None:
    with pytest.raises(UsernameTakenError):
        asyncio.run(auth(db).register("alice", "long-enough"))
    with pytest.raises(ValidationError):
        asyncio.run(auth(db).register("Erin!", "long-enough"))
    with pytest.raises(ValidationError):
        asyncio.run(auth(db).register("erin", "short"))


def test_wrong_password_and_unknown_user_look_the_same(db: FakeDatabase) -> None:
    with pytest.raises(InvalidCredentialsError):
        asyncio.run(auth(db).login("alice", "wrong-password"))
    with pytest.raises(InvalidCredentialsError):
        asyncio.run(auth(db).login("nobody", "wrong-password"))


def test_sessions_expire(db: FakeDatabase) -> None:
    started = asyncio.run(auth(db).register("erin", "long-enough"))
    db.clock += timedelta(hours=2)
    with pytest.raises(NotAuthenticatedError):
        asyncio.run(auth(db).current_user(started.token))


# --- group management ------------------------------------------------------------


def groups(db: FakeDatabase) -> GroupService:
    return GroupService(FakeUnitOfWork(db))


def test_create_group_makes_creator_owner_and_member(db: FakeDatabase) -> None:
    view = asyncio.run(groups(db).create("  Sukhumvit   Loft ", "dave"))
    assert view.name == "Sukhumvit Loft"
    assert view.members == ["dave"] and view.owner == "dave"
    assert len(view.invite_code) >= 12
    with pytest.raises(ValidationError):
        asyncio.run(groups(db).create("   ", "dave"))


def test_only_owner_manages(db: FakeDatabase) -> None:
    with pytest.raises(NotOwnerError):
        asyncio.run(groups(db).rename(1, "Mine now", "bob"))
    with pytest.raises(NotOwnerError):
        asyncio.run(groups(db).reset_invite(1, "bob"))
    with pytest.raises(NotOwnerError):
        asyncio.run(groups(db).delete(1, "bob"))
    with pytest.raises(NotOwnerError):
        asyncio.run(groups(db).remove_member(1, "carol", "bob"))
    renamed = asyncio.run(groups(db).rename(1, "Ari Condo 12B", "alice"))
    assert renamed.name == "Ari Condo 12B"


def test_invite_join_and_reset(db: FakeDatabase) -> None:
    preview = asyncio.run(groups(db).preview_invite("ari-code", "dave"))
    assert (preview.name, preview.member_count, preview.already_member) == (
        "Ari Condo 12A",
        3,
        False,
    )
    joined = asyncio.run(groups(db).join("ari-code", "dave"))
    assert joined.members == ["alice", "bob", "carol", "dave"]  # appended last
    again = asyncio.run(groups(db).join("ari-code", "dave"))
    assert again.members == joined.members  # joining twice changes nothing

    reset = asyncio.run(groups(db).reset_invite(1, "alice"))
    assert reset.invite_code != "ari-code"
    with pytest.raises(InviteNotFoundError):
        asyncio.run(groups(db).join("ari-code", "erin"))


def test_leave_and_remove_need_a_settled_balance(db: FakeDatabase) -> None:
    asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))  # bob, carol now owe alice
    with pytest.raises(UnsettledBalanceError):
        asyncio.run(groups(db).remove_member(1, "bob", "bob"))
    with pytest.raises(UnsettledBalanceError):
        asyncio.run(groups(db).remove_member(1, "carol", "alice"))
    with pytest.raises(OwnerCannotLeaveError):
        asyncio.run(groups(db).remove_member(1, "alice", "alice"))

    asyncio.run(groups(db).join("ari-code", "dave"))
    asyncio.run(groups(db).remove_member(1, "dave", "dave"))  # settled: may leave
    assert "dave" not in db.groups[1].members


def test_delete_group_removes_its_bills(db: FakeDatabase) -> None:
    asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
    asyncio.run(groups(db).delete(1, "alice"))
    assert 1 not in db.groups and db.expenses == {}


# --- editing bills -----------------------------------------------------------------


def test_payer_edits_bill_and_shares_are_recomputed(db: FakeDatabase) -> None:
    created = asyncio.run(expenses(db).create(DINNER, "alice", "key-1"))
    edited = CreateExpenseCommand(
        **{**DINNER.__dict__, "amount": "90.00", "members": ("bob", "carol")}
    )
    view = asyncio.run(expenses(db).update(created.id, edited, "alice"))
    assert view.id == created.id and view.amount == "90.00"
    assert view.shares == [("bob", "45.00"), ("carol", "45.00")]
    with pytest.raises(NotPayerError):
        asyncio.run(expenses(db).update(created.id, edited, "bob"))
    with pytest.raises(ValidationError):
        bad = CreateExpenseCommand(**{**DINNER.__dict__, "amount": "1,000"})
        asyncio.run(expenses(db).update(created.id, bad, "alice"))
