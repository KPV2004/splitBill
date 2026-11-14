"""Groups, expenses and balances — every route requires a session (→ 401) and the
use cases enforce 404 / 403 (AI_NOTES.md §5)."""

from typing import Annotated

from fastapi import APIRouter, Header, status

from app.application.use_cases.expenses import CreateExpenseCommand
from app.presentation.deps import CurrentUser, ExpensesDep, GroupsDep
from app.presentation.schemas.api import BalanceOut, EqualSplitIn, ExpenseIn, ExpenseOut, GroupOut

router = APIRouter(prefix="/groups", tags=["groups"])

IdempotencyKey = Annotated[str | None, Header(alias="Idempotency-Key", max_length=255)]


@router.get("")
async def list_groups(username: CurrentUser, groups: GroupsDep) -> list[GroupOut]:
    return [GroupOut.of(view) for view in await groups.list_groups(username)]


@router.get("/{group_id}")
async def get_group(group_id: int, username: CurrentUser, groups: GroupsDep) -> GroupOut:
    return GroupOut.of(await groups.get_group(group_id, username))


@router.get("/{group_id}/balances")
async def get_balances(group_id: int, username: CurrentUser, groups: GroupsDep) -> list[BalanceOut]:
    return [BalanceOut.of(view) for view in await groups.balances(group_id, username)]


@router.get("/{group_id}/expenses", response_model_exclude_none=True)
async def list_expenses(
    group_id: int, username: CurrentUser, expenses: ExpensesDep
) -> list[ExpenseOut]:
    return [ExpenseOut.of(view) for view in await expenses.list(group_id, username)]


@router.post(
    "/{group_id}/expenses", status_code=status.HTTP_201_CREATED, response_model_exclude_none=True
)
async def create_expense(
    group_id: int,
    body: ExpenseIn,
    username: CurrentUser,
    expenses: ExpensesDep,
    idempotency_key: IdempotencyKey = None,
) -> ExpenseOut:
    split = body.split
    command = CreateExpenseCommand(
        group_id=group_id,
        description=body.description,
        paid_by=body.paid_by,
        amount=body.amount,
        split_type=split.type,
        members=split.members if isinstance(split, EqualSplitIn) else (),
        shares=None if isinstance(split, EqualSplitIn) else split.shares,
    )
    return ExpenseOut.of(await expenses.create(command, username, idempotency_key))


@router.delete("/{group_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    group_id: int, expense_id: int, username: CurrentUser, expenses: ExpensesDep
) -> None:
    await expenses.delete(group_id, expense_id, username)
