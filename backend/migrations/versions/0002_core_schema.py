"""Core schema: users, sessions, groups, members, expenses, shares, idempotency keys.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("username", sa.String(32), primary_key=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        _created_at(),
    )
    op.create_table(
        "sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "username",
            sa.String(32),
            sa.ForeignKey("users.username", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        _created_at(),
    )
    op.create_index("ix_sessions_username", "sessions", ["username"])

    op.create_table(
        "groups",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        _created_at(),
    )
    op.create_table(
        "group_members",
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("username", sa.String(32), sa.ForeignKey("users.username"), primary_key=True),
        sa.Column("position", sa.Integer, nullable=False),
        sa.UniqueConstraint("group_id", "position"),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("paid_by", sa.String(32), sa.ForeignKey("users.username"), nullable=False),
        sa.Column("amount_cents", sa.BigInteger, nullable=False),
        sa.Column("split_type", sa.String(5), nullable=False),
        _created_at(),
        sa.CheckConstraint("amount_cents > 0", name="amount_positive"),
        sa.CheckConstraint("split_type IN ('equal', 'exact')", name="split_type_known"),
    )
    op.create_index("ix_expenses_group_id", "expenses", ["group_id"])

    op.create_table(
        "expense_shares",
        sa.Column(
            "expense_id",
            sa.BigInteger,
            sa.ForeignKey("expenses.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("username", sa.String(32), sa.ForeignKey("users.username"), primary_key=True),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("cents", sa.BigInteger, nullable=False),
        sa.CheckConstraint("cents >= 0", name="share_not_negative"),
    )

    op.create_table(
        "idempotency_keys",
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("key", sa.String(255), primary_key=True),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("response", postgresql.JSONB, nullable=False),
        _created_at(),
    )


def downgrade() -> None:
    op.drop_table("idempotency_keys")
    op.drop_table("expense_shares")
    op.drop_index("ix_expenses_group_id", table_name="expenses")
    op.drop_table("expenses")
    op.drop_table("group_members")
    op.drop_table("groups")
    op.drop_index("ix_sessions_username", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("users")
