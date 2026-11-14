"""One consistent JSON error shape for the whole API: {"detail": "<message>"} (AI_NOTES.md §6).

Domain errors are raised by use cases and mapped to status codes here; routers never
raise HTTPException for business rules.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain.errors import (
    DomainError,
    ExpenseNotFoundError,
    GroupNotFoundError,
    IdempotencyConflictError,
    InvalidCredentialsError,
    MissingIdempotencyKeyError,
    NotAuthenticatedError,
    NotMemberError,
    NotPayerError,
    UsernameTakenError,
    ValidationError,
)

logger = logging.getLogger(__name__)

STATUS_BY_ERROR: dict[type[DomainError], int] = {
    ValidationError: status.HTTP_400_BAD_REQUEST,
    MissingIdempotencyKeyError: status.HTTP_400_BAD_REQUEST,
    NotAuthenticatedError: status.HTTP_401_UNAUTHORIZED,
    InvalidCredentialsError: status.HTTP_401_UNAUTHORIZED,
    NotMemberError: status.HTTP_403_FORBIDDEN,
    NotPayerError: status.HTTP_403_FORBIDDEN,
    GroupNotFoundError: status.HTTP_404_NOT_FOUND,
    ExpenseNotFoundError: status.HTTP_404_NOT_FOUND,
    IdempotencyConflictError: status.HTTP_409_CONFLICT,
    UsernameTakenError: status.HTTP_409_CONFLICT,
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_handler(request: Request, exc: DomainError) -> JSONResponse:
        """Business-rule violations → their mapped 4xx with the human-readable message."""
        code = STATUS_BY_ERROR.get(type(exc), status.HTTP_400_BAD_REQUEST)
        return JSONResponse(status_code=code, content={"detail": exc.message})

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Malformed request body/params → 422, flattened to the standard error shape."""
        messages = "; ".join(
            f"{'.'.join(str(loc) for loc in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"detail": messages},
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        """Last-resort guard: log everything internally, leak nothing (SECURITY_RULES.md §3.4)."""
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
