"""One database session = one unit of work, shared by every repository in a request."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.repositories import (
    SqlExpenseRepository,
    SqlGroupRepository,
    SqlIdempotencyStore,
    SqlSessionRepository,
    SqlUserRepository,
)


class SqlUnitOfWork:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self.users = SqlUserRepository(session)
        self.sessions = SqlSessionRepository(session)
        self.groups = SqlGroupRepository(session)
        self.expenses = SqlExpenseRepository(session)
        self.idempotency = SqlIdempotencyStore(session)

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()
