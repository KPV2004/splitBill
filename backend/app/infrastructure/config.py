"""Application settings loaded from environment / .env (SECURITY_RULES.md §3.6).

No paths or secrets in code: every URL/credential comes from the environment.
Credential-bearing fields have NO defaults — the app fails fast at startup when
they are missing (AI_NOTES.md §1.1 #2).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Env-driven configuration. Field names map case-insensitively to environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    log_level: str = "info"

    # Database — credentials live ONLY in .env / environment, never here.
    postgres_user: str
    postgres_password: str  # required: fail fast instead of silently defaulting
    postgres_db: str
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    cors_origins: str = "http://localhost:5173"

    # Sessions (AI_NOTES.md §4.5). Set SESSION_COOKIE_SECURE=true anywhere served over HTTPS.
    session_ttl_hours: int = 168
    session_cookie_secure: bool = False

    # Only read by the demo seed command (`make seed`); never needed to run the API.
    seed_demo_password: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_url(self) -> str:
        """SQLAlchemy async URL built from parts.

        Assumes URL-safe credentials; if a password ever contains special characters,
        encode it here with urllib.parse.quote_plus — never store an encoded URL in code.
        """
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
