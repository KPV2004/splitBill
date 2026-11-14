"""Groups, expenses and balances — every route requires a session (→ 401) and the
use cases enforce 404 / 403 (AI_NOTES.md §5)."""

from typing import Annotated

from fastapi import APIRouter, Header, status

from app.application.use_cases.expenses import CreateExpenseCommand
from app.presentation.deps import CurrentUser, ExpensesDep, GroupsDep
from app.presentation.schemas.api import (
    BalanceOut,
    EqualSplitIn,
    ExpenseIn,
    ExpenseOut,
    GroupIn,
    GroupOut,
)

router = APIRouter(prefix="/groups", tags=["groups"])

IdempotencyKey = Annotated[str | None, Header(alias="Idempotency-Key", max_length=255)]


@router.get("")
async def list_groups(username: CurrentUser, groups: GroupsDep) -> list[GroupOut]:
    return [GroupOut.of(view) for view in await groups.list_groups(username)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_group(body: GroupIn, username: CurrentUser, groups: GroupsDep) -> GroupOut:
    return GroupOut.of(await groups.create(body.name, username))


@router.patch("/{group_id}")
async def rename_group(
    group_id: int, body: GroupIn, username: CurrentUser, groups: GroupsDep
) -> GroupOut:
    return GroupOut.of(await groups.rename(group_id, body.name, username))


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: int, username: CurrentUser, groups: GroupsDep) -> None:
    await groups.delete(group_id, username)


@router.post("/{group_id}/invite/reset")
async def reset_invite(group_id: int, username: CurrentUser, groups: GroupsDep) -> GroupOut:
    return GroupOut.of(await groups.reset_invite(group_id, username))


@router.delete("/{group_id}/members/{member}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int, member: str, username: CurrentUser, groups: GroupsDep
) -> None:
    """Owner removes a member, or a member removes themself (leave)."""
    await groups.remove_member(group_id, member, username)


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
    command = _command(group_id, body)
    return ExpenseOut.of(await expenses.create(command, username, idempotency_key))


@router.put("/{group_id}/expenses/{expense_id}", response_model_exclude_none=True)
async def update_expense(
    group_id: int,
    expense_id: int,
    body: ExpenseIn,
    username: CurrentUser,
    expenses: ExpensesDep,
) -> ExpenseOut:
    """Replace a bill (its payer only)."""
    return ExpenseOut.of(await expenses.update(expense_id, _command(group_id, body), username))


@router.delete("/{group_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    group_id: int, expense_id: int, username: CurrentUser, expenses: ExpensesDep
) -> None:
    await expenses.delete(group_id, expense_id, username)


def _command(group_id: int, body: ExpenseIn) -> CreateExpenseCommand:
    split = body.split
    return CreateExpenseCommand(
        group_id=group_id,
        description=body.description,
        paid_by=body.paid_by,
        amount=body.amount,
        split_type=split.type,
        members=split.members if isinstance(split, EqualSplitIn) else (),
        shares=None if isinstance(split, EqualSplitIn) else split.shares,
    )
