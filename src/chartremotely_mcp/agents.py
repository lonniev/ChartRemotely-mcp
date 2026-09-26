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
#: How long a kept capture lives. Two hours, so a few looks at one symbol
#: have time to gather into a small set before the first of them goes.
CAPTURE_TTL_SECONDS = 2 * 60 * 60
#: The same span in words, for replies and docs.
CAPTURE_TTL_WORDS = "two hours"
#: How many symbols a display keeps captures of; the one idle longest goes.
SYMBOLS_KEPT = 12
#: How many captures of one symbol a display keeps; the oldest goes.
CAPTURES_PER_SYMBOL = 6
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


#: What a scale may look like: the words an agent's reply states ("half",
#: "30 minutes", "1 day"). Metadata in the clear, shown back to callers, so
#: anything outside this shape is dropped rather than kept.
_SCALE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 .:/-]{0,23}$")


def scale_label(raw: object) -> str | None:
    """A scale as kept: inner whitespace collapsed, at most 24 characters.

    None when absent or not scale-shaped - a scale is only a label, so a bad
    one is dropped, never an error that costs the picture.
    """
    if not isinstance(raw, str):
        return None
    label = " ".join(raw.split())
    return label if _SCALE.match(label) else None


#: A capture's id: 16 lower-case hex digits, minted here and nowhere else.
#: It is bound into the capture's AAD and handed back by callers, so nothing
#: of any other shape is ever looked up.
_CAPTURE_ID = re.compile(r"^[0-9a-f]{16}$")


def new_capture_id() -> str:
    return secrets.token_hex(8)


def capture_key(raw: object) -> str:
    """A capture id as asked for: trimmed. Raises ValueError for anything else."""
    key = raw.strip() if isinstance(raw, str) else None
    if key is None or not _CAPTURE_ID.match(key):
        raise ValueError("that is not a capture id")
    return key


#: The display's own answer to "read": "PLTR at half".
_READ_REPLY = re.compile(r"^(\S{1,15}) at (.{1,24})$")


def read_label(reply: object) -> tuple[str, str | None]:
    """(symbol key, scale) from a display's "read" reply.

    Anything that is not that shape, or names something that is not a
    symbol, reads as unlabelled - a label is only a label, never worth
    losing the picture over.
    """
    text = reply.strip() if isinstance(reply, str) else ""
    m = None if text.startswith("ERR") else _READ_REPLY.match(text)
    if not m:
        return UNLABELLED, None
    try:
        return symbol_key(m.group(1)), scale_label(m.group(2))
    except ValueError:
        return UNLABELLED, None


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
