"""Money, split and balance rules (AI_NOTES.md §4, §8 required cases)."""

import pytest

from app.domain.balances import compute_balances
from app.domain.entities import Expense, Group, Share
from app.domain.errors import ValidationError
from app.domain.money import format_cents, parse_amount
from app.domain.splits import equal_split, exact_split

GROUP = Group(1, "Ari Condo 12A", ("alice", "bob", "carol"))


@pytest.mark.parametrize(
    ("raw", "cents"),
    [("1000.00", 100000), ("1000", 100000), ("0.1", 10), ("333.33", 33333), (" 5.5 ", 550)],
)
def test_parse_amount_accepts_plain_amounts(raw: str, cents: int) -> None:
    assert parse_amount(raw) == cents


@pytest.mark.parametrize(
    "raw", ["", "abc", "-5", "1,000.00", "1.234", "1e3", "0", "0.00", "100000000.00", ".5"]
)
def test_parse_amount_rejects_everything_else(raw: str) -> None:
    with pytest.raises(ValidationError):
        parse_amount(raw)


def test_zero_allowed_only_when_asked() -> None:
    assert parse_amount("0.00", allow_zero=True) == 0


def test_format_cents() -> None:
    assert format_cents(100000) == "1000.00"
    assert format_cents(-33333) == "-333.33"
    assert format_cents(5) == "0.05"


def test_equal_split_golden_example() -> None:
    shares = equal_split(100000, ["alice", "bob", "carol"], GROUP)
    assert [(s.member, format_cents(s.cents)) for s in shares] == [
        ("alice", "333.34"),
        ("bob", "333.33"),
        ("carol", "333.33"),
    ]


def test_equal_split_remainder_follows_request_order() -> None:
    shares = equal_split(100000, ["carol", "alice", "bob"], GROUP)
    assert shares[0] == Share("carol", 33334)


def test_equal_split_rejects_unknown_and_duplicate_members() -> None:
    with pytest.raises(ValidationError):
        equal_split(100, ["alice", "dave"], GROUP)
    with pytest.raises(ValidationError):
        equal_split(100, ["alice", "alice"], GROUP)
    with pytest.raises(ValidationError):
        equal_split(100, [], GROUP)


def test_exact_split_must_sum_to_amount() -> None:
    shares = exact_split(100000, {"alice": "500.00", "bob": "300.00", "carol": "200.00"}, GROUP)
    assert sum(s.cents for s in shares) == 100000
    with pytest.raises(ValidationError, match="add up"):
        exact_split(100000, {"alice": "500.00", "bob": "300.00"}, GROUP)


def test_exact_split_rejects_bad_share_amounts() -> None:
    with pytest.raises(ValidationError):
        exact_split(100000, {"alice": "1000.001"}, GROUP)


def test_balances_golden_example_sum_to_zero() -> None:
    expense = Expense(
        id=1,
        group_id=1,
        description="Dinner",
        paid_by="alice",
        amount_cents=100000,
        split_type="equal",
        shares=equal_split(100000, ["alice", "bob", "carol"], GROUP),
    )
    balances = compute_balances(GROUP, [expense])
    assert [(m, format_cents(c)) for m, c in balances] == [
        ("alice", "666.66"),
        ("bob", "-333.33"),
        ("carol", "-333.33"),
    ]
    assert sum(c for _, c in balances) == 0
