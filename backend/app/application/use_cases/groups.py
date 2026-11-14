"""Groups: reads, and management by their owner. Every group-scoped call checks access
here, not in routers, so no entry point can skip it (SECURITY_RULES.md §3.1): unknown
group → 404, not a member → 403, member but not the owner → 403 for owner-only actions."""

import secrets

from app.application.dto import BalanceView, GroupView, InvitePreview
from app.application.ports import UnitOfWork
from app.domain.balances import compute_balances
from app.domain.entities import Group
from app.domain.errors import (
    GroupNotFoundError,
    InviteNotFoundError,
    NotMemberError,
    NotOwnerError,
    OwnerCannotLeaveError,
    UnsettledBalanceError,
    ValidationError,
)
from app.domain.money import format_cents

MAX_GROUP_NAME = 100


async def load_group_for_member(uow: UnitOfWork, group_id: int, username: str) -> Group:
    group = await uow.groups.get(group_id)
    if group is None:
        raise GroupNotFoundError()
    if not group.has_member(username):
        raise NotMemberError()
    return group


async def load_group_for_owner(uow: UnitOfWork, group_id: int, username: str) -> Group:
    group = await load_group_for_member(uow, group_id, username)
    if not group.is_owner(username):
        raise NotOwnerError()
    return group


def new_invite_code() -> str:
    """12 URL-safe characters (72 random bits): unguessable, short enough to share."""
    return secrets.token_urlsafe(9)


def _clean_name(name: str) -> str:
    cleaned = " ".join(name.split())
    if not cleaned:
        raise ValidationError("Give the group a name.")
    if len(cleaned) > MAX_GROUP_NAME:
        raise ValidationError(f"Group names can be at most {MAX_GROUP_NAME} characters.")
    return cleaned


class GroupService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def list_groups(self, username: str) -> list[GroupView]:
        return [GroupView.of(group) for group in await self._uow.groups.list_for_member(username)]

    async def get_group(self, group_id: int, username: str) -> GroupView:
        return GroupView.of(await load_group_for_member(self._uow, group_id, username))

    async def balances(self, group_id: int, username: str) -> list[BalanceView]:
        group = await load_group_for_member(self._uow, group_id, username)
        return [
            BalanceView(member=member, balance=format_cents(cents))
            for member, cents in await self._balances(group)
        ]

    async def create(self, name: str, username: str) -> GroupView:
        group = await self._uow.groups.create(_clean_name(name), username, new_invite_code())
        await self._uow.commit()
        return GroupView.of(group)

    async def rename(self, group_id: int, name: str, username: str) -> GroupView:
        await load_group_for_owner(self._uow, group_id, username)
        await self._uow.groups.rename(group_id, _clean_name(name))
        await self._uow.commit()
        return await self.get_group(group_id, username)

    async def reset_invite(self, group_id: int, username: str) -> GroupView:
        await load_group_for_owner(self._uow, group_id, username)
        await self._uow.groups.set_invite_code(group_id, new_invite_code())
        await self._uow.commit()
        return await self.get_group(group_id, username)

    async def delete(self, group_id: int, username: str) -> None:
        await load_group_for_owner(self._uow, group_id, username)
        await self._uow.groups.delete(group_id)
        await self._uow.commit()

    async def preview_invite(self, invite_code: str, username: str) -> InvitePreview:
        group = await self._group_for_invite(invite_code)
        return InvitePreview(
            group_id=group.id,
            name=group.name,
            owner=group.owner,
            member_count=len(group.members),
            already_member=group.has_member(username),
        )

    async def join(self, invite_code: str, username: str) -> GroupView:
        """Joining twice is harmless: an existing member just gets the group back."""
        group = await self._group_for_invite(invite_code)
        if not group.has_member(username):
            await self._uow.groups.add_member(group.id, username)
            await self._uow.commit()
        return await self.get_group(group.id, username)

    async def remove_member(self, group_id: int, member: str, username: str) -> None:
        """The owner removes someone, or a member removes themself (leaving)."""
        group = await load_group_for_member(self._uow, group_id, username)
        if member != username and not group.is_owner(username):
            raise NotOwnerError()
        if not group.has_member(member):
            raise ValidationError(f"{member} is not a member of this group.")
        if group.is_owner(member):
            raise OwnerCannotLeaveError()
        # The ledger must keep summing to zero: only settled members can go.
        if dict(await self._balances(group)).get(member, 0) != 0:
            raise UnsettledBalanceError(member)
        await self._uow.groups.remove_member(group_id, member)
        await self._uow.commit()

    async def _group_for_invite(self, invite_code: str) -> Group:
        group = await self._uow.groups.get_by_invite(invite_code) if invite_code else None
        if group is None:
            raise InviteNotFoundError()
        return group

    async def _balances(self, group: Group) -> list[tuple[str, int]]:
        return compute_balances(group, await self._uow.expenses.list_for_group(group.id))
