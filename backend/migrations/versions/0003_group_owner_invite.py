"""Groups get an owner and an invite code.

Existing groups are backfilled: the owner is the first member (lowest position) and the
invite code is random. Both columns are then required, and invite codes are unique.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("owner", sa.String(32), nullable=True))
    op.add_column("groups", sa.Column("invite_code", sa.String(32), nullable=True))
    op.execute(
        """
        UPDATE groups g
        SET owner = (
                SELECT m.username FROM group_members m
                WHERE m.group_id = g.id ORDER BY m.position LIMIT 1
            ),
            invite_code = substr(md5(random()::text || g.id::text || clock_timestamp()::text), 1, 12)
        """
    )
    op.alter_column("groups", "owner", nullable=False)
    op.alter_column("groups", "invite_code", nullable=False)
    op.create_foreign_key("groups_owner_fkey", "groups", "users", ["owner"], ["username"])
    op.create_unique_constraint("groups_invite_code_key", "groups", ["invite_code"])


def downgrade() -> None:
    op.drop_constraint("groups_invite_code_key", "groups", type_="unique")
    op.drop_constraint("groups_owner_fkey", "groups", type_="foreignkey")
    op.drop_column("groups", "invite_code")
    op.drop_column("groups", "owner")
