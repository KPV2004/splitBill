"""SQLAlchemy implementations of the application ports. Parameterized queries only
(SECURITY_RULES.md §3.3)."""

from dataclasses import asdict
from datetime import datetime

from sqlalchemy import delete, func, select, update
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
    return Group(
        id=row.id,
        name=row.name,
        members=tuple(member.username for member in row.members),
        owner=row.owner,
        invite_code=row.invite_code,
    )


class SqlGroupRepository:
    """Reads use populate_existing so a write earlier in the same request (join, rename)
    is never hidden by a stale row in the session's identity map."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_member(self, username: str) -> list[Group]:
        rows = await self._session.scalars(
            select(GroupRow)
            .join(GroupMemberRow, GroupMemberRow.group_id == GroupRow.id)
            .where(GroupMemberRow.username == username)
            .order_by(GroupRow.id)
            .execution_options(populate_existing=True)
        )
        return [_to_group(row) for row in rows]

    async def get(self, group_id: int) -> Group | None:
        row = await self._session.get(GroupRow, group_id, populate_existing=True)
        return _to_group(row) if row else None

    async def get_by_invite(self, invite_code: str) -> Group | None:
        row = await self._session.scalar(
            select(GroupRow)
            .where(GroupRow.invite_code == invite_code)
            .execution_options(populate_existing=True)
        )
        return _to_group(row) if row else None

    async def create(self, name: str, owner: str, invite_code: str) -> Group:
        row = GroupRow(name=name, owner=owner, invite_code=invite_code)
        self._session.add(row)
        await self._session.flush()
        self._session.add(GroupMemberRow(group_id=row.id, username=owner, position=0))
        await self._session.flush()
        return Group(id=row.id, name=name, members=(owner,), owner=owner, invite_code=invite_code)

    async def rename(self, group_id: int, name: str) -> None:
        await self._session.execute(
            update(GroupRow).where(GroupRow.id == group_id).values(name=name)
        )

    async def set_invite_code(self, group_id: int, invite_code: str) -> None:
        await self._session.execute(
            update(GroupRow).where(GroupRow.id == group_id).values(invite_code=invite_code)
        )

    async def delete(self, group_id: int) -> None:
        # Members, expenses (and their shares) and idempotency keys cascade in the database.
        await self._session.execute(delete(GroupRow).where(GroupRow.id == group_id))

    async def add_member(self, group_id: int, username: str) -> None:
        last = await self._session.scalar(
            select(func.max(GroupMemberRow.position)).where(GroupMemberRow.group_id == group_id)
        )
        position = -1 if last is None else last
        self._session.add(
            GroupMemberRow(group_id=group_id, username=username, position=position + 1)
        )
        await self._session.flush()

    async def remove_member(self, group_id: int, username: str) -> None:
        await self._session.execute(
            delete(GroupMemberRow).where(
                GroupMemberRow.group_id == group_id, GroupMemberRow.username == username
            )
        )


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

    async def replace(self, expense_id: int, expense: NewExpense) -> Expense:
        # Old shares go first, in their own statement: re-inserting the same
        # (expense_id, username) keys in one flush would collide.
        await self._session.execute(
            delete(ExpenseShareRow).where(ExpenseShareRow.expense_id == expense_id)
        )
        await self._session.execute(
            update(ExpenseRow)
            .where(ExpenseRow.id == expense_id)
            .values(
                description=expense.description,
                paid_by=expense.paid_by,
                amount_cents=expense.amount_cents,
                split_type=expense.split_type,
            )
        )
        self._session.add_all(
            ExpenseShareRow(
                expense_id=expense_id, username=share.member, position=index, cents=share.cents
            )
            for index, share in enumerate(expense.shares)
        )
        await self._session.flush()
        row = await self._session.scalar(
            select(ExpenseRow)
            .where(ExpenseRow.id == expense_id)
            .execution_options(populate_existing=True)
        )
        assert row is not None
        return _to_expense(row)

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
