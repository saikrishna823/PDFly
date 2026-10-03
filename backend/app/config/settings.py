from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "PDFly API"
    app_version: str = "0.1.0"
    environment: Literal["development", "production"] = "development"
    log_level: str = "INFO"

    # Comma-separated in the environment, e.g.
    # ALLOWED_ORIGINS=https://saikrishna823.github.io,http://localhost:4200
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:4200", "http://127.0.0.1:4200"]
    )

    max_upload_mb: int = Field(default=25, ge=1, le=500)

    rate_limit_enabled: bool = True
    rate_limit_requests: int = Field(default=30, ge=1)
    rate_limit_window_seconds: int = Field(default=60, ge=1)

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
