"""In-memory implementations of the application ports, for unit and API tests."""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from app.application.dto import IdempotencyRecord
from app.application.ports import IdempotencyRaceError
from app.domain.entities import Expense, Group, NewExpense, User
from app.domain.errors import UsernameTakenError


@dataclass
class FakeDatabase:
    """State shared by every unit of work, like a real database."""

    users: dict[str, User] = field(default_factory=dict)
    sessions: dict[str, tuple[str, datetime]] = field(default_factory=dict)
    groups: dict[int, Group] = field(default_factory=dict)
    expenses: dict[int, Expense] = field(default_factory=dict)
    idempotency: dict[tuple[int, str], IdempotencyRecord] = field(default_factory=dict)
    next_expense_id: int = 1
    clock: datetime = datetime(2026, 11, 1, 12, 0, tzinfo=UTC)
    commits: int = 0

    def tick(self) -> datetime:
        self.clock += timedelta(minutes=1)
        return self.clock


class _Users:
    def __init__(self, db: FakeDatabase) -> None:
        self._db = db

    async def get(self, username: str) -> User | None:
        return self._db.users.get(username)

    async def add(self, user: User) -> None:
        if user.username in self._db.users:
            raise UsernameTakenError()
        self._db.users[user.username] = user


class _Sessions:
    def __init__(self, db: FakeDatabase) -> None:
        self._db = db

    async def add(self, token_hash: str, username: str, expires_at: datetime) -> None:
        self._db.sessions[token_hash] = (username, expires_at)

    async def username_for(self, token_hash: str, now: datetime) -> str | None:
        found = self._db.sessions.get(token_hash)
        if found is None or found[1] <= now:
            return None
        return found[0]

    async def delete(self, token_hash: str) -> None:
        self._db.sessions.pop(token_hash, None)


class _Groups:
    def __init__(self, db: FakeDatabase) -> None:
        self._db = db

    async def list_for_member(self, username: str) -> list[Group]:
        return [g for _, g in sorted(self._db.groups.items()) if g.has_member(username)]

    async def get(self, group_id: int) -> Group | None:
        return self._db.groups.get(group_id)


class _Expenses:
    def __init__(self, db: FakeDatabase) -> None:
        self._db = db

    async def add(self, expense: NewExpense) -> Expense:
        stored = Expense(
            id=self._db.next_expense_id,
            group_id=expense.group_id,
            description=expense.description,
            paid_by=expense.paid_by,
            amount_cents=expense.amount_cents,
            split_type=expense.split_type,
            shares=expense.shares,
            created_at=self._db.tick(),
        )
        self._db.next_expense_id += 1
        self._db.expenses[stored.id] = stored
        return stored

    async def list_for_group(self, group_id: int) -> list[Expense]:
        found = [e for e in self._db.expenses.values() if e.group_id == group_id]
        return sorted(found, key=lambda e: (e.created_at, e.id), reverse=True)

    async def get(self, group_id: int, expense_id: int) -> Expense | None:
        expense = self._db.expenses.get(expense_id)
        return expense if expense and expense.group_id == group_id else None

    async def delete(self, expense_id: int) -> None:
        self._db.expenses.pop(expense_id, None)


class _Idempotency:
    def __init__(self, db: FakeDatabase, race_with: IdempotencyRecord | None) -> None:
        self._db = db
        self._race_with = race_with

    async def get(self, group_id: int, key: str) -> IdempotencyRecord | None:
        return self._db.idempotency.get((group_id, key))

    async def add(self, group_id: int, key: str, record: IdempotencyRecord) -> None:
        if self._race_with is not None:
            # Simulate a concurrent request that stored this key a moment earlier.
            self._db.idempotency[(group_id, key)] = self._race_with
            raise IdempotencyRaceError()
        if (group_id, key) in self._db.idempotency:
            raise IdempotencyRaceError()
        self._db.idempotency[(group_id, key)] = record


class FakeUnitOfWork:
    """Writes go straight to the shared state; rollback undoes expenses added since
    the last commit (enough to model the idempotency race)."""

    def __init__(self, db: FakeDatabase, race_with: IdempotencyRecord | None = None) -> None:
        self._db = db
        self.users = _Users(db)
        self.sessions = _Sessions(db)
        self.groups = _Groups(db)
        self.expenses = _Expenses(db)
        self.idempotency = _Idempotency(db, race_with)
        self._committed_ids = set(db.expenses)

    async def commit(self) -> None:
        self._db.commits += 1
        self._committed_ids = set(self._db.expenses)

    async def rollback(self) -> None:
        for expense_id in set(self._db.expenses) - self._committed_ids:
            del self._db.expenses[expense_id]


class FakeHasher:
    """Fast, deterministic stand-in for scrypt."""

    async def hash(self, password: str) -> str:
        return f"fake${password}"

    async def verify(self, password: str, password_hash: str) -> bool:
        return password_hash == f"fake${password}"


def household(db: FakeDatabase) -> None:
    """The golden-example household plus one alice is not in."""
    for name in ("alice", "bob", "carol", "dave"):
        db.users[name] = User(name, f"fake$pw-{name}-123")
    db.groups[1] = Group(1, "Ari Condo 12A", ("alice", "bob", "carol"))
    db.groups[2] = Group(2, "Chiang Mai Flat", ("bob", "carol", "dave"))
