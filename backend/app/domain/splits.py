"""Split rules (AI_NOTES.md §4.2–4.3): equal splits in integer satang with leftover
satang handed out one at a time in list order; exact splits must sum to the amount."""

from collections.abc import Mapping, Sequence

from app.domain.entities import Group, Share
from app.domain.errors import ValidationError
from app.domain.money import parse_amount


def equal_split(amount_cents: int, members: Sequence[str], group: Group) -> tuple[Share, ...]:
    """1000.00 among [alice, bob, carol] → 333.34, 333.33, 333.33."""
    if not members:
        raise ValidationError("An equal split needs at least one member.")
    if len(set(members)) != len(members):
        raise ValidationError("Each member can appear only once in a split.")
    _require_members(members, group)
    base, remainder = divmod(amount_cents, len(members))
    return tuple(
        Share(member, base + (1 if index < remainder else 0))
        for index, member in enumerate(members)
    )


def exact_split(amount_cents: int, shares: Mapping[str, str], group: Group) -> tuple[Share, ...]:
    """Every share is an amount string; together they must equal the expense amount."""
    if not shares:
        raise ValidationError("An exact split needs at least one share.")
    _require_members(list(shares), group)
    parsed = tuple(
        Share(member, parse_amount(raw, field=f"share for {member}", allow_zero=True))
        for member, raw in shares.items()
    )
    if sum(share.cents for share in parsed) != amount_cents:
        raise ValidationError("The shares do not add up to the total.")
    return parsed


def _require_members(members: Sequence[str], group: Group) -> None:
    unknown = [member for member in members if not group.has_member(member)]
    if unknown:
        raise ValidationError(f"Not a member of this group: {', '.join(unknown)}.")
