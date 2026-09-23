"""Agent registry and relay. Pure domain logic - no billing, no MCP.

The operator never drives a display itself. It pairs agents running on
patrons' machines and relays a narrow vocabulary to them, which is why this
module deals only in identities, codes and message passing.

Two properties matter and are enforced here:

* **Agents dial out.** Nothing in this module ever connects to a patron.
  Agents open a connection and wait; commands are handed to whoever is
  already waiting. No patron needs an open port.
* **Commands are opaque.** The operator does not parse or rewrite them. The
  agent decides what is in its vocabulary, so a compromised operator cannot
  widen the surface.
"""

from __future__ import annotations

import asyncio
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


class Registry:
    """Who owns which display.

    In-memory for now. The Authority provisions a Neon database for exactly
    this, and swapping the backing store is the next step - the surface
    below is deliberately small so that change stays contained.
    """

    def __init__(self) -> None:
        self._agents: dict[str, Agent] = {}
        self._codes: dict[str, PendingCode] = {}

    # -- pairing ---------------------------------------------------------

    def open_code(self) -> str:
        """Called by an agent that wants to be adopted."""
        self._sweep()
        code = new_pairing_code()
        self._codes[code] = PendingCode(code=code)
        return code

    def claim(self, code: str, npub: str, label: str) -> Agent:
        """Called by a patron, via MCP, to adopt a waiting agent."""
        self._sweep()
        pending = self._codes.get(code.strip().upper())
        if pending is None:
            raise KeyError("unknown or expired pairing code")
        if pending.agent_id is not None:
            raise KeyError("pairing code already used")
        agent = Agent(agent_id=new_agent_id(), npub=npub,
                      label=label or "display", secret=new_secret())
        pending.agent_id, pending.secret = agent.agent_id, agent.secret
        self._agents[agent.agent_id] = agent
        return agent

    def collect(self, code: str) -> tuple[str, str] | None:
        """Called by the waiting agent: has a patron claimed me yet?"""
        pending = self._codes.get(code.strip().upper())
        if pending is None or pending.agent_id is None:
            return None
        del self._codes[pending.code]        # single use
        return pending.agent_id, pending.secret or ""

    # -- lookup ----------------------------------------------------------

    def authenticate(self, agent_id: str, secret: str) -> Agent | None:
        agent = self._agents.get(agent_id)
        if agent is None or not secrets.compare_digest(agent.secret, secret):
            return None
        return agent

    def for_npub(self, npub: str) -> list[Agent]:
        return [a for a in self._agents.values() if a.npub == npub]

    def resolve(self, npub: str, display: str | None) -> Agent:
        """Pick which display a request means.

        A patron with one agent should never have to name it; a patron with
        several must.
        """
        owned = self.for_npub(npub)
        if not owned:
            raise LookupError("no agent paired to this npub")
        if display:
            wanted = display.strip().lower()
            match = [a for a in owned
                     if a.label.lower() == wanted or a.agent_id == display]
            if not match:
                names = ", ".join(a.label for a in owned)
                raise LookupError(f"no display named {display!r}; you have: {names}")
            return match[0]
        if len(owned) > 1:
            names = ", ".join(a.label for a in owned)
            raise LookupError(f"several displays are paired - name one: {names}")
        return owned[0]

    def _sweep(self) -> None:
        for code in [c for c, p in self._codes.items() if p.expired()]:
            del self._codes[code]


class Relay:
    """Hands commands to agents that are already waiting."""

    def __init__(self) -> None:
        self._waiting: dict[str, asyncio.Queue] = {}
        self._results: dict[str, asyncio.Future] = {}

    def _queue(self, agent_id: str) -> asyncio.Queue:
        return self._waiting.setdefault(agent_id, asyncio.Queue())

    async def send(self, agent_id: str, command: str,
                   timeout: float = COMMAND_TIMEOUT_SECONDS) -> str:
        """Queue a command and wait for the agent's reply.

        Raises TimeoutError when no agent collects it, which the caller must
        treat as a failure and refund. A chart command is only meaningful
        now, so nothing is queued for later delivery.
        """
        request_id = secrets.token_hex(8)
        loop = asyncio.get_running_loop()
        self._results[request_id] = loop.create_future()
        await self._queue(agent_id).put({"id": request_id, "command": command})
        try:
            return await asyncio.wait_for(self._results[request_id], timeout)
        finally:
            self._results.pop(request_id, None)

    async def next_for(self, agent_id: str, timeout: float) -> dict | None:
        """Called by a polling agent. Returns None when nothing arrived."""
        try:
            return await asyncio.wait_for(self._queue(agent_id).get(), timeout)
        except TimeoutError:
            return None

    def deliver(self, request_id: str, reply: str) -> bool:
        future = self._results.get(request_id)
        if future is None or future.done():
            return False
        future.set_result(reply)
        return True
