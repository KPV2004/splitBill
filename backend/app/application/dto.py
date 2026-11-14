"""Plain data passed between layers. Money leaves the application as strings."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from app.domain.entities import Expense, Group
from app.domain.money import format_cents


@dataclass(frozen=True)
class GroupView:
    """A group as its members see it (only members ever get one)."""

    id: int
    name: str
    members: list[str]
    owner: str
    invite_code: str

    @classmethod
    def of(cls, group: Group) -> "GroupView":
        return cls(
            id=group.id,
            name=group.name,
            members=list(group.members),
            owner=group.owner,
            invite_code=group.invite_code,
        )


@dataclass(frozen=True)
class InvitePreview:
    """What a signed-in visitor sees before joining from an invite link."""

    group_id: int
    name: str
    owner: str
    member_count: int
    already_member: bool


@dataclass(frozen=True)
class ExpenseView:
    id: int
    description: str
    paid_by: str
    amount: str
    split_type: Literal["equal", "exact"]
    # (member, "333.34") in split order.
    shares: list[tuple[str, str]]
    created_at: str | None

    @classmethod
    def of(cls, expense: Expense) -> "ExpenseView":
        return cls(
            id=expense.id,
            description=expense.description,
            paid_by=expense.paid_by,
            amount=format_cents(expense.amount_cents),
            split_type=expense.split_type,
            shares=[(share.member, format_cents(share.cents)) for share in expense.shares],
            created_at=_iso(expense.created_at),
        )


@dataclass(frozen=True)
class BalanceView:
    member: str
    balance: str


@dataclass(frozen=True)
class IdempotencyRecord:
    """What a stored POST answered, so a retry gets the same answer."""

    request_hash: str
    expense: ExpenseView


@dataclass(frozen=True)
class SessionStart:
    username: str
    token: str
    expires_at: datetime


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None
