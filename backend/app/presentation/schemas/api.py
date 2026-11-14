"""Request/response shapes (AI_NOTES.md §5). Money is always a string; unknown fields
are rejected (SECURITY_RULES.md §3.2)."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.application.dto import BalanceView, ExpenseView, GroupView

Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
AmountText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Credentials(StrictModel):
    username: Username
    password: Annotated[str, StringConstraints(min_length=1, max_length=256)]


class UserOut(BaseModel):
    username: str


class EqualSplitIn(StrictModel):
    type: Literal["equal"]
    members: Annotated[list[Username], Field(min_length=1, max_length=50)]


class ExactSplitIn(StrictModel):
    type: Literal["exact"]
    shares: Annotated[dict[Username, AmountText], Field(min_length=1, max_length=50)]


class ExpenseIn(StrictModel):
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]
    paid_by: Username
    amount: AmountText
    split: Annotated[EqualSplitIn | ExactSplitIn, Field(discriminator="type")]


class GroupOut(BaseModel):
    id: int
    name: str
    members: list[str]

    @classmethod
    def of(cls, view: GroupView) -> "GroupOut":
        return cls(id=view.id, name=view.name, members=view.members)


class SplitOut(BaseModel):
    type: Literal["equal", "exact"]
    members: list[str] | None = None
    shares: dict[str, str] | None = None


class ExpenseOut(BaseModel):
    id: int
    description: str
    paid_by: str
    amount: str
    split: SplitOut
    # How the amount was actually divided, member → "333.34", in split order.
    shares: dict[str, str]
    created_at: str | None

    @classmethod
    def of(cls, view: ExpenseView) -> "ExpenseOut":
        shares = dict(view.shares)
        split = (
            SplitOut(type="equal", members=list(shares))
            if view.split_type == "equal"
            else SplitOut(type="exact", shares=shares)
        )
        return cls(
            id=view.id,
            description=view.description,
            paid_by=view.paid_by,
            amount=view.amount,
            split=split,
            shares=shares,
            created_at=view.created_at,
        )


class BalanceOut(BaseModel):
    member: str
    balance: str

    @classmethod
    def of(cls, view: BalanceView) -> "BalanceOut":
        return cls(member=view.member, balance=view.balance)
