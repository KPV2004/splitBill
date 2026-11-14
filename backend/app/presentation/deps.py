"""Request wiring: one unit of work per request, the session cookie → current user,
and the use-case services. Tests override `get_uow` with an in-memory fake."""

from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Annotated

from fastapi import Cookie, Depends

from app.application.ports import PasswordHasher, UnitOfWork
from app.application.use_cases.auth import AuthService
from app.application.use_cases.expenses import ExpenseService
from app.application.use_cases.groups import GroupService
from app.infrastructure.config import settings
from app.infrastructure.persistence.db import SessionLocal
from app.infrastructure.persistence.uow import SqlUnitOfWork
from app.infrastructure.security import ScryptPasswordHasher

SESSION_COOKIE = "sb_session"


async def get_uow() -> AsyncIterator[UnitOfWork]:
    async with SessionLocal() as session:
        yield SqlUnitOfWork(session)


def get_hasher() -> PasswordHasher:
    return ScryptPasswordHasher()


UowDep = Annotated[UnitOfWork, Depends(get_uow)]
SessionToken = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]


def get_auth_service(
    uow: UowDep, hasher: Annotated[PasswordHasher, Depends(get_hasher)]
) -> AuthService:
    return AuthService(uow, hasher, session_ttl=timedelta(hours=settings.session_ttl_hours))


AuthDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_current_user(auth: AuthDep, token: SessionToken = None) -> str:
    """The signed-in username; raises NotAuthenticatedError (→ 401) otherwise."""
    return await auth.current_user(token)


CurrentUser = Annotated[str, Depends(get_current_user)]


def get_group_service(uow: UowDep) -> GroupService:
    return GroupService(uow)


def get_expense_service(uow: UowDep) -> ExpenseService:
    return ExpenseService(uow)


GroupsDep = Annotated[GroupService, Depends(get_group_service)]
ExpensesDep = Annotated[ExpenseService, Depends(get_expense_service)]
