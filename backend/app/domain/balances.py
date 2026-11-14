"""Balances (AI_NOTES.md §4.4): paid − owed per member; positive = owed to them.
Across all members they always sum to 0."""

from collections.abc import Iterable

from app.domain.entities import Expense, Group


def compute_balances(group: Group, expenses: Iterable[Expense]) -> list[tuple[str, int]]:
    """(member, cents) in group member order."""
    totals = dict.fromkeys(group.members, 0)
    for expense in expenses:
        totals[expense.paid_by] = totals.get(expense.paid_by, 0) + expense.amount_cents
        for share in expense.shares:
            totals[share.member] = totals.get(share.member, 0) - share.cents
    return [(member, totals[member]) for member in group.members]
