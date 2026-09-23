"""Settings for the ChartRemotely operator.

Only the Nostr identity is required to boot. Every secret - BTCPay and the
rest - arrives through Secure Courier rather than the environment.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # -- Nostr identity (the one env var needed to boot) --------------
    tollbooth_nostr_operator_nsec: str | None = None

    # -- Credit economics ---------------------------------------------
    seed_balance_sats: int = 25
    credit_ttl_seconds: int = 604800  # 7 days

    # -- Constraint Engine (opt-in) -----------------------------------
    constraints_enabled: bool = False
    constraints_config: str | None = None

    # -- Nostr relays (optional override) -----------------------------
    tollbooth_nostr_relays: str | None = None

    # -- Relay tuning --------------------------------------------------
    #: How long an agent's poll is held open before answering empty. Long
    #: enough that idle agents are nearly silent, short enough that no
    #: intermediary times the connection out.
    agent_poll_seconds: float = 25.0

    model_config = {"env_prefix": "", "env_file": ".env"}


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
