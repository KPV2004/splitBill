"""Domain and application errors. Pure Python — HTTP mapping lives in
presentation/error_handlers.py (AI_NOTES.md §6). Every message is written for people:
the frontend shows it verbatim."""


class DomainError(Exception):
    """Base for every business-rule violation."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ValidationError(DomainError):
    """Input breaks a business rule (bad amount, split mismatch, unknown member...)."""


class NotAuthenticatedError(DomainError):
    """No valid session."""

    def __init__(self, message: str = "You are not signed in.") -> None:
        super().__init__(message)


class InvalidCredentialsError(DomainError):
    def __init__(self) -> None:
        super().__init__("Incorrect username or password.")


class UsernameTakenError(DomainError):
    def __init__(self) -> None:
        super().__init__("That username is already taken.")


class NotMemberError(DomainError):
    def __init__(self) -> None:
        super().__init__("You are not a member of this group.")


class NotPayerError(DomainError):
    def __init__(self) -> None:
        super().__init__("Only the person who paid can delete this expense.")


class GroupNotFoundError(DomainError):
    def __init__(self) -> None:
        super().__init__("Group not found.")


class ExpenseNotFoundError(DomainError):
    def __init__(self) -> None:
        super().__init__("Expense not found.")


class MissingIdempotencyKeyError(DomainError):
    def __init__(self) -> None:
        super().__init__("The Idempotency-Key header is required.")


class IdempotencyConflictError(DomainError):
    def __init__(self) -> None:
        super().__init__("This Idempotency-Key was already used with a different request.")
