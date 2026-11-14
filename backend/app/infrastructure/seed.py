"""Demo data for local development: `make seed` (run `make migrate` first).

Creates the demo accounts (alice, bob, carol, dave), three households, and a few bills
— the same data the frontend mock ships. The accounts' password comes from
SEED_DEMO_PASSWORD in .env; nothing secret lives in code (SECURITY_RULES.md §2.4).
Safe to re-run: existing users and groups are left as they are.
"""

import asyncio
import logging
import sys

from sqlalchemy import select

from app.domain.entities import Group
from app.domain.money import parse_amount
from app.domain.splits import equal_split, exact_split
from app.infrastructure.config import settings
from app.infrastructure.persistence.db import SessionLocal, engine
from app.infrastructure.persistence.models import (
    ExpenseRow,
    ExpenseShareRow,
    GroupMemberRow,
    GroupRow,
    UserRow,
)
from app.infrastructure.security import hash_password

logger = logging.getLogger("seed")

USERS = ["alice", "bob", "carol", "dave"]
GROUPS: list[tuple[str, list[str]]] = [
    ("Ari Condo 12A", ["alice", "bob", "carol"]),
    ("Lat Phrao House", ["alice", "bob"]),
    ("Chiang Mai Flat", ["bob", "carol", "dave"]),
]
# (group name, description, payer, amount, split): oldest first.
BILLS: list[tuple[str, str, str, str, dict[str, str] | list[str]]] = [
    ("Ari Condo 12A", "Rent November", "alice", "18000.00",
     {"alice": "7000.00", "bob": "5500.00", "carol": "5500.00"}),
    ("Ari Condo 12A", "Internet (True 1Gbps)", "bob", "599.00", ["alice", "bob", "carol"]),
    ("Ari Condo 12A", "Makro groceries", "carol", "2315.40", ["alice", "bob", "carol"]),
    ("Ari Condo 12A", "Electricity October", "alice", "1842.75", ["alice", "bob", "carol"]),
    ("Lat Phrao House", "Water bill", "bob", "212.00", ["alice", "bob"]),
]  # fmt: skip


async def seed(password: str) -> None:
    async with SessionLocal() as session:
        existing = set(await session.scalars(select(UserRow.username)))
        password_hash = hash_password(password)
        for username in USERS:
            if username not in existing:
                session.add(UserRow(username=username, password_hash=password_hash))

        # Only groups created in this run get demo bills, so re-running adds nothing.
        new_groups: dict[str, Group] = {}
        for name, members in GROUPS:
            if await session.scalar(select(GroupRow.id).where(GroupRow.name == name)) is not None:
                continue
            row = GroupRow(name=name)
            session.add(row)
            await session.flush()
            for position, username in enumerate(members):
                session.add(GroupMemberRow(group_id=row.id, username=username, position=position))
            new_groups[name] = Group(id=row.id, name=name, members=tuple(members))

        for group_name, description, payer, amount, split in BILLS:
            group = new_groups.get(group_name)
            if group is None:
                continue
            cents = parse_amount(amount)
            shares = (
                exact_split(cents, split, group)
                if isinstance(split, dict)
                else equal_split(cents, split, group)
            )
            session.add(
                ExpenseRow(
                    group_id=group.id,
                    description=description,
                    paid_by=payer,
                    amount_cents=cents,
                    split_type="exact" if isinstance(split, dict) else "equal",
                    shares=[
                        ExpenseShareRow(username=share.member, position=index, cents=share.cents)
                        for index, share in enumerate(shares)
                    ],
                )
            )
        await session.commit()
    await engine.dispose()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    password = settings.seed_demo_password
    if not password or len(password) < 8:
        logger.error("Set SEED_DEMO_PASSWORD in .env (at least 8 characters) to seed demo users.")
        sys.exit(1)
    asyncio.run(seed(password))
    logger.info("Demo users (%s) and households are in place.", ", ".join(USERS))


if __name__ == "__main__":
    main()
