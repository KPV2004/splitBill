"""SQLAlchemy table models. The schema itself is owned by Alembic migrations
(AI_NOTES.md §1.1 #1); these models must match them and are never used to create tables."""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(32), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SessionRow(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(
        ForeignKey("users.username", ondelete="CASCADE"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GroupRow(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    owner: Mapped[str] = mapped_column(ForeignKey("users.username"))
    invite_code: Mapped[str] = mapped_column(String(32), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list["GroupMemberRow"]] = relationship(
        order_by="GroupMemberRow.position", lazy="selectin"
    )


class GroupMemberRow(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "position"),)

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True
    )
    username: Mapped[str] = mapped_column(ForeignKey("users.username"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)


class ExpenseRow(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="amount_positive"),
        CheckConstraint("split_type IN ('equal', 'exact')", name="split_type_known"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(200))
    paid_by: Mapped[str] = mapped_column(ForeignKey("users.username"))
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    split_type: Mapped[str] = mapped_column(String(5))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    shares: Mapped[list["ExpenseShareRow"]] = relationship(
        order_by="ExpenseShareRow.position",
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ExpenseShareRow(Base):
    __tablename__ = "expense_shares"
    __table_args__ = (CheckConstraint("cents >= 0", name="share_not_negative"),)

    expense_id: Mapped[int] = mapped_column(
        ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True
    )
    username: Mapped[str] = mapped_column(ForeignKey("users.username"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)
    cents: Mapped[int] = mapped_column(BigInteger)


class IdempotencyKeyRow(Base):
    __tablename__ = "idempotency_keys"

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True
    )
    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
