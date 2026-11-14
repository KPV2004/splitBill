"""Interfaces the use cases depend on (AI_NOTES.md §3.2). Infrastructure implements
them; tests use in-memory fakes."""

from datetime import datetime
from typing import Protocol

from app.application.dto import IdempotencyRecord
from app.domain.entities import Expense, Group, NewExpense, User


class UserRepository(Protocol):
    async def get(self, username: str) -> User | None: ...

    async def add(self, user: User) -> None:
        """Raises UsernameTakenError if the username exists (checked at flush)."""
        ...


class SessionRepository(Protocol):
    async def add(self, token_hash: str, username: str, expires_at: datetime) -> None: ...

    async def username_for(self, token_hash: str, now: datetime) -> str | None:
        """The session's user, or None when unknown or expired."""
        ...

    async def delete(self, token_hash: str) -> None: ...


class GroupRepository(Protocol):
    async def list_for_member(self, username: str) -> list[Group]: ...

    async def get(self, group_id: int) -> Group | None: ...


class ExpenseRepository(Protocol):
    async def add(self, expense: NewExpense) -> Expense: ...

    async def list_for_group(self, group_id: int) -> list[Expense]:
        """Newest first; ties broken by newest id."""
        ...

    async def get(self, group_id: int, expense_id: int) -> Expense | None: ...

    async def delete(self, expense_id: int) -> None: ...


class IdempotencyStore(Protocol):
    async def get(self, group_id: int, key: str) -> IdempotencyRecord | None: ...

    async def add(self, group_id: int, key: str, record: IdempotencyRecord) -> None:
        """Raises IdempotencyRaceError if another request stored this key first."""
        ...


class UnitOfWork(Protocol):
    """One transaction's worth of repositories."""

    users: UserRepository
    sessions: SessionRepository
    groups: GroupRepository
    expenses: ExpenseRepository
    idempotency: IdempotencyStore

    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...


class PasswordHasher(Protocol):
    async def hash(self, password: str) -> str: ...

    async def verify(self, password: str, password_hash: str) -> bool: ...


class IdempotencyRaceError(Exception):
    """Two requests stored the same (group, key) concurrently; the loser replays."""
