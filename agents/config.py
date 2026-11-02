"""Environment configuration for the Forgevyn dev-team CLI."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

AGENTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = AGENTS_DIR.parent

# Service-local values win; the repo-level .env is only a fallback.
load_dotenv(AGENTS_DIR / ".env", override=False)
load_dotenv(REPO_ROOT / ".env", override=False)


class ConfigurationError(RuntimeError):
    """Raised when the dev crew is missing required configuration."""


def python_supported() -> bool:
    """CrewAI 1.15.33 supports Python 3.10-3.13 (not 3.14+)."""
    return (3, 10) <= sys.version_info[:2] < (3, 14)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError as exc:
        raise ConfigurationError(f"Expected an integer, got '{value}'.") from exc
    return max(minimum, min(parsed, maximum))


@dataclass(frozen=True)
class Settings:
    provider: str
    model: str
    temperature: float
    verbose: bool
    deepseek_api_key: str | None
    deepseek_api_base: str
    openai_api_key: str | None
    openai_api_base: str | None
    max_workers: int
    repo_root: Path

    @property
    def api_key(self) -> str | None:
        if self.provider == "deepseek":
            return self.deepseek_api_key or None
        return self.openai_api_key or None

    @property
    def api_base(self) -> str | None:
        if self.provider == "deepseek":
            return self.deepseek_api_base or None
        return self.openai_api_base or None

    def require_api_key(self) -> None:
        if self.api_key:
            return
        key_name = (
            "DEEPSEEK_API_KEY"
            if self.provider == "deepseek"
            else "OPENAI_API_KEY"
        )
        raise ConfigurationError(
            f"{key_name} is not set. Add it to agents/.env, or run the CLI "
            "with --dry-run to generate plans and DeepSeek prompts without an "
            "API call."
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    provider = (os.getenv("CREW_LLM_PROVIDER") or "deepseek").strip().lower()
    if provider not in {"deepseek", "openai", "openai-compatible"}:
        raise ConfigurationError(
            "CREW_LLM_PROVIDER must be one of: deepseek, openai, openai-compatible."
        )

    default_model = (
        "deepseek/deepseek-chat"
        if provider == "deepseek"
        else "openai/gpt-4o-mini"
    )
    model = (os.getenv("CREW_MODEL") or default_model).strip()

    try:
        temperature = float(os.getenv("CREW_TEMPERATURE", "0.2"))
    except ValueError as exc:
        raise ConfigurationError("CREW_TEMPERATURE must be a number.") from exc

    repo_root = Path(
        os.getenv("AGENTS_REPO_ROOT") or REPO_ROOT
    ).expanduser().resolve()

    return Settings(
        provider=provider,
        model=model,
        temperature=temperature,
        verbose=_as_bool(os.getenv("CREW_VERBOSE"), False),
        deepseek_api_key=os.getenv("DEEPSEEK_API_KEY"),
        deepseek_api_base=(
            os.getenv("DEEPSEEK_API_BASE") or "https://api.deepseek.com/v1"
        ).rstrip("/"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_api_base=(os.getenv("OPENAI_API_BASE") or None),
        max_workers=_as_int(os.getenv("AGENTS_MAX_WORKERS"), 3, 1, 8),
        repo_root=repo_root,
    )
