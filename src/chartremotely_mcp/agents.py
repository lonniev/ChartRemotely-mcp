"""Identities and constants for paired displays.

Pure types shared by the store and the tools - no database, no MCP, no
billing. The durable behaviour lives in :mod:`store`, because a registry
held in a process does not survive Horizon: instances recycle, and a tool
call and an agent's open poll can land on different ones.

Two properties hold throughout:

* **Agents dial out.** Nothing here ever connects to a patron. Agents open
  a connection and wait, so no patron needs an open port.
* **Commands are opaque.** The operator does not parse or rewrite them. The
  agent decides what is in its vocabulary, so a compromised operator cannot
  widen the surface.
"""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field

# Ambiguous glyphs removed: a pairing code may be read aloud or typed from a
# screen across the room.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
CODE_TTL_SECONDS = 15 * 60
COMMAND_TIMEOUT_SECONDS = 45


def new_pairing_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(CODE_LENGTH))


def new_secret() -> str:
    return secrets.token_urlsafe(32)


def new_agent_id() -> str:
    return secrets.token_hex(8)


@dataclass
class Agent:
    """A paired display."""

    agent_id: str
    npub: str
    label: str
    secret: str
    paired_at: float = field(default_factory=time.time)
    last_seen: float = 0.0

    def connected(self, within: float = 90.0) -> bool:
        """Whether an agent is currently holding a poll open.

        Derived from the last poll rather than tracked as state: a dropped
        connection is indistinguishable from a slow one, and only recency
        answers the question a caller actually has.
        """
        return (time.time() - self.last_seen) < within


@dataclass
class PendingCode:
    code: str
    created_at: float = field(default_factory=time.time)
    agent_id: str | None = None
    secret: str | None = None

    def expired(self, now: float | None = None) -> bool:
        return ((now or time.time()) - self.created_at) > CODE_TTL_SECONDS
