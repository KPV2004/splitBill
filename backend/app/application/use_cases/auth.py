"""Accounts and sessions (AI_NOTES.md §4.5). Sessions are random tokens; only their
SHA-256 is stored, so a database leak does not hand out live sessions."""

import hashlib
import re
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from app.application.dto import SessionStart
from app.application.ports import PasswordHasher, UnitOfWork
from app.domain.entities import User
from app.domain.errors import (
    InvalidCredentialsError,
    NotAuthenticatedError,
    UsernameTakenError,
    ValidationError,
)

USERNAME_PATTERN = re.compile(r"[a-z0-9._-]{3,32}")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    def __init__(
        self,
        uow: UnitOfWork,
        hasher: PasswordHasher,
        session_ttl: timedelta,
        clock: Clock = utc_now,
    ) -> None:
        self._uow = uow
        self._hasher = hasher
        self._ttl = session_ttl
        self._clock = clock

    async def register(self, username: str, password: str) -> SessionStart:
        if not USERNAME_PATTERN.fullmatch(username):
            raise ValidationError(
                "Usernames are 3–32 characters: lowercase letters, numbers, dots, "
                "dashes or underscores."
            )
        _check_password(password)
        if await self._uow.users.get(username) is not None:
            raise UsernameTakenError()
        user = User(username=username, password_hash=await self._hasher.hash(password))
        await self._uow.users.add(user)  # raises UsernameTakenError on a concurrent signup
        start = await self._start_session(username)
        await self._uow.commit()
        return start

    async def login(self, username: str, password: str) -> SessionStart:
        user = await self._uow.users.get(username)
        if user is None:
            # Spend the same time as a real check so timing doesn't reveal usernames.
            await self._hasher.hash(password)
            raise InvalidCredentialsError()
        if not await self._hasher.verify(password, user.password_hash):
            raise InvalidCredentialsError()
        start = await self._start_session(username)
        await self._uow.commit()
        return start

    async def logout(self, token: str | None) -> None:
        if token:
            await self._uow.sessions.delete(hash_token(token))
            await self._uow.commit()

    async def current_user(self, token: str | None) -> str:
        if not token:
            raise NotAuthenticatedError()
        username = await self._uow.sessions.username_for(hash_token(token), self._clock())
        if username is None:
            raise NotAuthenticatedError()
        return username

    async def _start_session(self, username: str) -> SessionStart:
        token = secrets.token_urlsafe(32)
        expires_at = self._clock() + self._ttl
        await self._uow.sessions.add(hash_token(token), username, expires_at)
        return SessionStart(username=username, token=token, expires_at=expires_at)


def _check_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"Passwords need at least {MIN_PASSWORD_LENGTH} characters.")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValidationError(f"Passwords can be at most {MAX_PASSWORD_LENGTH} characters.")
