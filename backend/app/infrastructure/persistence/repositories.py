"""SQLAlchemy implementations of the application ports. Parameterized queries only
(SECURITY_RULES.md §3.3)."""

from dataclasses import asdict
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto import ExpenseView, IdempotencyRecord
from app.application.ports import IdempotencyRaceError
from app.domain.entities import Expense, Group, NewExpense, Share, User
from app.domain.errors import UsernameTakenError
from app.infrastructure.persistence.models import (
    ExpenseRow,
    ExpenseShareRow,
    GroupMemberRow,
    GroupRow,
    IdempotencyKeyRow,
    SessionRow,
    UserRow,
)


class SqlUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, username: str) -> User | None:
        row = await self._session.get(UserRow, username)
        return User(username=row.username, password_hash=row.password_hash) if row else None

    async def add(self, user: User) -> None:
        self._session.add(UserRow(username=user.username, password_hash=user.password_hash))
        try:
            await self._session.flush()
        except IntegrityError as exc:
            raise UsernameTakenError() from exc


class SqlSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token_hash: str, username: str, expires_at: datetime) -> None:
        self._session.add(
            SessionRow(token_hash=token_hash, username=username, expires_at=expires_at)
        )
        await self._session.flush()

    async def username_for(self, token_hash: str, now: datetime) -> str | None:
        return await self._session.scalar(
            select(SessionRow.username).where(
                SessionRow.token_hash == token_hash, SessionRow.expires_at > now
            )
        )

    async def delete(self, token_hash: str) -> None:
        await self._session.execute(delete(SessionRow).where(SessionRow.token_hash == token_hash))


def _to_group(row: GroupRow) -> Group:
    return Group(id=row.id, name=row.name, members=tuple(member.username for member in row.members))


class SqlGroupRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_member(self, username: str) -> list[Group]:
        rows = await self._session.scalars(
            select(GroupRow)
            .join(GroupMemberRow, GroupMemberRow.group_id == GroupRow.id)
            .where(GroupMemberRow.username == username)
            .order_by(GroupRow.id)
        )
        return [_to_group(row) for row in rows]

    async def get(self, group_id: int) -> Group | None:
        row = await self._session.get(GroupRow, group_id)
        return _to_group(row) if row else None


def _to_expense(row: ExpenseRow) -> Expense:
    return Expense(
        id=row.id,
        group_id=row.group_id,
        description=row.description,
        paid_by=row.paid_by,
        amount_cents=row.amount_cents,
        split_type="equal" if row.split_type == "equal" else "exact",
        shares=tuple(Share(member=share.username, cents=share.cents) for share in row.shares),
        created_at=row.created_at,
    )


class SqlExpenseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, expense: NewExpense) -> Expense:
        row = ExpenseRow(
            group_id=expense.group_id,
            description=expense.description,
            paid_by=expense.paid_by,
            amount_cents=expense.amount_cents,
            split_type=expense.split_type,
            shares=[
                ExpenseShareRow(username=share.member, position=index, cents=share.cents)
                for index, share in enumerate(expense.shares)
            ],
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row, ["created_at"])
        return _to_expense(row)

    async def list_for_group(self, group_id: int) -> list[Expense]:
        rows = await self._session.scalars(
            select(ExpenseRow)
            .where(ExpenseRow.group_id == group_id)
            .order_by(ExpenseRow.created_at.desc(), ExpenseRow.id.desc())
        )
        return [_to_expense(row) for row in rows]

    async def get(self, group_id: int, expense_id: int) -> Expense | None:
        row = await self._session.scalar(
            select(ExpenseRow).where(ExpenseRow.id == expense_id, ExpenseRow.group_id == group_id)
        )
        return _to_expense(row) if row else None

    async def delete(self, expense_id: int) -> None:
        await self._session.execute(delete(ExpenseRow).where(ExpenseRow.id == expense_id))


class SqlIdempotencyStore:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, group_id: int, key: str) -> IdempotencyRecord | None:
        row = await self._session.get(IdempotencyKeyRow, (group_id, key))
        if row is None:
            return None
        stored = dict(row.response)
        stored["shares"] = [tuple(pair) for pair in stored["shares"]]
        return IdempotencyRecord(request_hash=row.request_hash, expense=ExpenseView(**stored))

    async def add(self, group_id: int, key: str, record: IdempotencyRecord) -> None:
        self._session.add(
            IdempotencyKeyRow(
                group_id=group_id,
                key=key,
                request_hash=record.request_hash,
                response=asdict(record.expense),
            )
        )
        try:
            await self._session.flush()
        except IntegrityError as exc:
            raise IdempotencyRaceError() from exc
