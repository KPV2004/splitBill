"""Business entities — plain dataclasses, no framework imports (AI_NOTES.md §3.2)."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

SplitType = Literal["equal", "exact"]


@dataclass(frozen=True)
class User:
    username: str
    password_hash: str


@dataclass(frozen=True)
class Group:
    id: int
    name: str
    # Order matters: equal-split remainders and balance listings follow it.
    members: tuple[str, ...]
    # The creator; only they can rename, invite-reset, remove members or delete.
    owner: str = ""
    # Shared with friends as a join link; resetting it stops new joins with the old one.
    invite_code: str = ""

    def has_member(self, username: str) -> bool:
        return username in self.members

    def is_owner(self, username: str) -> bool:
        return username == self.owner


@dataclass(frozen=True)
class Share:
    member: str
    cents: int


@dataclass(frozen=True)
class NewExpense:
    """An expense that has passed every business rule but has no id yet."""

    group_id: int
    description: str
    paid_by: str
    amount_cents: int
    split_type: SplitType
    # In split order: the request's `members` list (equal) or `shares` order (exact).
    shares: tuple[Share, ...]


@dataclass(frozen=True)
class Expense:
    id: int
    group_id: int
    description: str
    paid_by: str
    amount_cents: int
    split_type: SplitType
    shares: tuple[Share, ...] = field(default_factory=tuple)
    created_at: datetime | None = None
