"""Expenses: create (idempotent), list, delete (payer only). AI_NOTES.md §4.2–4.7."""

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.application.dto import ExpenseView, IdempotencyRecord
from app.application.ports import IdempotencyRaceError, UnitOfWork
from app.application.use_cases.groups import load_group_for_member
from app.domain.entities import Expense, Group, NewExpense, Share, SplitType
from app.domain.errors import (
    ExpenseNotFoundError,
    IdempotencyConflictError,
    MissingIdempotencyKeyError,
    NotPayerError,
    ValidationError,
)
from app.domain.money import parse_amount
from app.domain.splits import equal_split, exact_split


@dataclass(frozen=True)
class CreateExpenseCommand:
    group_id: int
    description: str
    paid_by: str
    amount: str
    split_type: str
    # Equal split: who shares it, in order. Exact split: member → amount string.
    members: Sequence[str] = ()
    shares: Mapping[str, str] | None = None

    def fingerprint(self) -> str:
        """Stable hash of what was asked, to tell a retry from a different request."""
        canonical = json.dumps(
            {
                "description": self.description,
                "paid_by": self.paid_by,
                "amount": self.amount,
                "split_type": self.split_type,
                "members": list(self.members),
                "shares": list((self.shares or {}).items()),
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical.encode()).hexdigest()


class ExpenseService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def create(
        self, command: CreateExpenseCommand, username: str, idempotency_key: str | None
    ) -> ExpenseView:
        # Access first (404/403), then the request itself (SECURITY_RULES.md §3.1).
        group = await load_group_for_member(self._uow, command.group_id, username)
        if not idempotency_key:
            raise MissingIdempotencyKeyError()

        fingerprint = command.fingerprint()
        replay = await self._replay(command.group_id, idempotency_key, fingerprint)
        if replay is not None:
            return replay

        expense = await self._uow.expenses.add(_build_expense(command, group))
        view = ExpenseView.of(expense)
        try:
            await self._uow.idempotency.add(
                group.id, idempotency_key, IdempotencyRecord(request_hash=fingerprint, expense=view)
            )
            await self._uow.commit()
        except IdempotencyRaceError:
            # A concurrent request with the same key won; drop ours and answer like it.
            await self._uow.rollback()
            replay = await self._replay(command.group_id, idempotency_key, fingerprint)
            if replay is None:  # pragma: no cover — the winner's row must exist
                raise
            return replay
        return view

    async def list(self, group_id: int, username: str) -> list[ExpenseView]:
        await load_group_for_member(self._uow, group_id, username)
        return [
            ExpenseView.of(expense) for expense in await self._uow.expenses.list_for_group(group_id)
        ]

    async def update(
        self, expense_id: int, command: CreateExpenseCommand, username: str
    ) -> ExpenseView:
        """Replace a bill; only its current payer may (the new payer can be anyone in the
        group). Same rules as creating. PUT is naturally idempotent, so no key is needed."""
        group = await load_group_for_member(self._uow, command.group_id, username)
        await self._payers_expense(command.group_id, expense_id, username)
        expense = await self._uow.expenses.replace(expense_id, _build_expense(command, group))
        await self._uow.commit()
        return ExpenseView.of(expense)

    async def delete(self, group_id: int, expense_id: int, username: str) -> None:
        await load_group_for_member(self._uow, group_id, username)
        await self._payers_expense(group_id, expense_id, username)
        await self._uow.expenses.delete(expense_id)
        await self._uow.commit()

    async def _payers_expense(self, group_id: int, expense_id: int, username: str) -> Expense:
        expense = await self._uow.expenses.get(group_id, expense_id)
        if expense is None:
            raise ExpenseNotFoundError()
        if expense.paid_by != username:
            raise NotPayerError()
        return expense

    async def _replay(self, group_id: int, key: str, fingerprint: str) -> ExpenseView | None:
        record = await self._uow.idempotency.get(group_id, key)
        if record is None:
            return None
        if record.request_hash != fingerprint:
            raise IdempotencyConflictError()
        return record.expense


def _build_expense(command: CreateExpenseCommand, group: Group) -> NewExpense:
    """Apply every business rule to a request; raises ValidationError on the first break."""
    description = command.description.strip()
    if not description:
        raise ValidationError("Add a description.")
    if not group.has_member(command.paid_by):
        raise ValidationError("The payer must be a member of this group.")
    amount_cents = parse_amount(command.amount)
    shares: tuple[Share, ...]
    split_type: SplitType
    if command.split_type == "equal":
        split_type = "equal"
        shares = equal_split(amount_cents, command.members, group)
    elif command.split_type == "exact":
        split_type = "exact"
        shares = exact_split(amount_cents, command.shares or {}, group)
    else:
        raise ValidationError('The split type must be "equal" or "exact".')
    return NewExpense(
        group_id=group.id,
        description=description,
        paid_by=command.paid_by,
        amount_cents=amount_cents,
        split_type=split_type,
        shares=shares,
    )
