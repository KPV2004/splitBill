"""THB money as integer satang (AI_NOTES.md §4.1). Never a float, never round()."""

import re
from decimal import Decimal, InvalidOperation

from app.domain.errors import ValidationError

# "1000", "1000.5", "1000.50" — no signs, no separators, no exponents.
_AMOUNT_PATTERN = re.compile(r"\d{1,8}(\.\d{1,2})?")

MAX_AMOUNT_CENTS = 9_999_999_999  # 99,999,999.99 THB (SECURITY_RULES.md §3.2)


def parse_amount(raw: str, *, field: str = "amount", allow_zero: bool = False) -> int:
    """Parse a non-negative THB amount string into integer satang.

    Rejects anything that is not plain digits with at most 2 decimals, rather than
    rounding it. Zero is rejected unless `allow_zero` (exact-split shares may be 0).
    """
    text = raw.strip()
    if not _AMOUNT_PATTERN.fullmatch(text):
        raise ValidationError(
            f'The {field} must be a positive amount with at most 2 decimals, like "250.50".'
        )
    try:
        cents = int(Decimal(text) * 100)
    except InvalidOperation as exc:  # unreachable given the pattern, kept as a guard
        raise ValidationError(f"The {field} is not a valid amount.") from exc
    if cents == 0 and not allow_zero:
        raise ValidationError(f"The {field} must be more than 0.00.")
    if cents > MAX_AMOUNT_CENTS:
        raise ValidationError(f"The {field} is too large (maximum 99,999,999.99).")
    return cents


def format_cents(cents: int) -> str:
    """Canonical API form: exactly 2 decimals, no separators — "1000.00", "-333.33"."""
    sign = "-" if cents < 0 else ""
    whole, fraction = divmod(abs(cents), 100)
    return f"{sign}{whole}.{fraction:02d}"
