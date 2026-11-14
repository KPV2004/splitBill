"""Accounts and sessions: register, login, logout, me."""

from fastapi import APIRouter, Response, status

from app.application.dto import SessionStart
from app.infrastructure.config import settings
from app.presentation.deps import SESSION_COOKIE, AuthDep, CurrentUser, SessionToken
from app.presentation.schemas.api import Credentials, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, start: SessionStart) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        start.token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: Credentials, response: Response, auth: AuthDep) -> UserOut:
    start = await auth.register(body.username, body.password)
    _set_session_cookie(response, start)
    return UserOut(username=start.username)


@router.post("/login")
async def login(body: Credentials, response: Response, auth: AuthDep) -> UserOut:
    start = await auth.login(body.username, body.password)
    _set_session_cookie(response, start)
    return UserOut(username=start.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, auth: AuthDep, token: SessionToken = None) -> None:
    await auth.logout(token)
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")


@router.get("/me")
async def me(username: CurrentUser) -> UserOut:
    return UserOut(username=username)
