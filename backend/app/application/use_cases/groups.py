"""Group reads. Every group-scoped call checks membership here, not in routers, so
no entry point can skip it (SECURITY_RULES.md §3.1): unknown group → 404, not a member → 403."""

from app.application.dto import BalanceView, GroupView
from app.application.ports import UnitOfWork
from app.domain.balances import compute_balances
from app.domain.entities import Group
from app.domain.errors import GroupNotFoundError, NotMemberError
from app.domain.money import format_cents


async def load_group_for_member(uow: UnitOfWork, group_id: int, username: str) -> Group:
    group = await uow.groups.get(group_id)
    if group is None:
        raise GroupNotFoundError()
    if not group.has_member(username):
        raise NotMemberError()
    return group


class GroupService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def list_groups(self, username: str) -> list[GroupView]:
        return [GroupView.of(group) for group in await self._uow.groups.list_for_member(username)]

    async def get_group(self, group_id: int, username: str) -> GroupView:
        return GroupView.of(await load_group_for_member(self._uow, group_id, username))

    async def balances(self, group_id: int, username: str) -> list[BalanceView]:
        group = await load_group_for_member(self._uow, group_id, username)
        expenses = await self._uow.expenses.list_for_group(group_id)
        return [
            BalanceView(member=member, balance=format_cents(cents))
            for member, cents in compute_balances(group, expenses)
        ]
