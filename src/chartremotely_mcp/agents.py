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

import re
import secrets
import time
from dataclasses import dataclass, field

# Ambiguous glyphs removed: a pairing code may be read aloud or typed from a
# screen across the room.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
CODE_TTL_SECONDS = 15 * 60
COMMAND_TIMEOUT_SECONDS = 45
#: How long a command forwarded from one display to another may take. Shorter
#: than a relayed tool call's, because a Siri Shortcut is waiting on it.
FORWARD_TIMEOUT_SECONDS = 25
#: How long a display's latest picture is kept for anyone to look at.
LATEST_TTL_SECONDS = 60 * 60
#: How many symbols' pictures a display keeps; the oldest beyond this go.
LATEST_KEEP = 12
#: The key a picture is kept under when the agent could not read the symbol.
#: A lone hyphen is inside the symbol charset but is nobody's ticker, so it
#: needs no special case in validation, and shows to people as "Chart".
UNLABELLED = "-"
UNLABELLED_NAME = "Chart"
#: What a symbol may look like: tickers, futures (/ES), indices (.SPX,
#: $SPX.X, ^VIX), share classes (BRK/B, BRK-B). It goes into AAD and back to
#: a browser, so nothing outside this shape is ever accepted.
_SYMBOL = re.compile(r"^[A-Z0-9./^$-]{1,15}$")


def symbol_key(raw: object) -> str:
    """A symbol as stored and matched: trimmed and upper-cased.

    Empty or absent means the picture is unlabelled. Raises ValueError for
    anything that is not symbol-shaped.
    """
    if raw is None:
        return UNLABELLED
    key = raw.strip().upper() if isinstance(raw, str) else None
    if key == "":
        return UNLABELLED
    if key is None or not _SYMBOL.match(key):
        raise ValueError("that is not a symbol")
    return key


#: What a display name is compared by: case, spaces, hyphens, underscores and
#: dots do not count, so dictation's "Mac mini", "mac-mini" and "macmini" are
#: one name. Nothing else is forgiven - no fuzzy matching, no guessing.
_NAME_NOISE = re.compile(r"[\s\-_.]+")


def display_key(name: str) -> str:
    """A display name as it is matched: lower-cased, without spaces, hyphens, underscores or dots."""
    return _NAME_NOISE.sub("", name).lower()


def symbol_name(key: str) -> str:
    """How a stored symbol key is shown to people."""
    return UNLABELLED_NAME if key == UNLABELLED else key


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
