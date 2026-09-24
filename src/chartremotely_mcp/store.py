"""Durable agent registry and command bus, on the operator's Neon schema.

The first cut kept both in process memory and it did not survive contact
with Horizon: a pairing made one minute was gone the next, and
``/agent/poll`` answered 403 for an agent that had just been adopted.

Two separate problems, both fixed by moving to the database:

* **Recycling.** Instances come and go. A registry in a Python dict goes
  with them.
* **Fan-out.** A tool call and an agent's open poll can land on different
  instances. An in-memory queue can never connect them, so the database
  is the message bus - a command is a row, and whichever instance holds
  the agent's poll claims it.

The Neon handle is the one the wheel already uses for pricing and vaults;
the Authority wires it during onboarding, so there is no connection string
here and none in the environment.

**No secret is stored in these tables.** An agent's bearer secret is a
per-patron credential and lives in the wheel's vault, encrypted at rest
with a key derived from the operator's nsec, reached through
``update_patron_credential`` / ``get_patron_credential``. Inventing a
second credential store beside that one would be strictly worse: plaintext,
unaudited, and readable by anything holding schema access.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from typing import Any, NamedTuple

from chartremotely_mcp import displays
from chartremotely_mcp.agents import (
    CODE_TTL_SECONDS,
    COMMAND_TIMEOUT_SECONDS,
    LATEST_KEEP,
    LATEST_TTL_SECONDS,
    Agent,
    new_agent_id,
    new_pairing_code,
    new_secret,
    scale_label,
    symbol_key,
)

#: How often a waiting caller re-reads its command row. Small enough to feel
#: immediate on a voice command, large enough not to hammer the database.
RESULT_POLL_SECONDS = 0.4
#: How often a polling agent re-checks for work within one held-open request.
CLAIM_POLL_SECONDS = 0.7


class KeptPicture(NamedTuple):
    """A display's kept picture: the image and what is known about it."""

    data_url: str
    taken: float
    symbol: str
    scale: str | None = None


class NoSuchDisplay(LookupError):
    """No display of the caller's answers to the name. Carries the names they have."""

    def __init__(self, wanted: str, owned: list[Agent]) -> None:
        self.names = [a.label for a in owned]
        super().__init__(f"no display named {wanted!r}; you have: " + ", ".join(self.names))


class AmbiguousDisplay(LookupError):
    """Several of the caller's displays answer to the name. Carries them."""

    def __init__(self, wanted: str, candidates: list[Agent]) -> None:
        self.candidates = candidates
        super().__init__(f"several displays answer to {wanted!r} - name one: "
                         + ", ".join(f"{a.label} ({a.agent_id})" for a in candidates))


class AgentStore:
    """CRUD and message passing for paired displays."""

    #: Credential field naming. One field per agent, because a patron may
    #: pair several displays and each carries its own bearer secret.
    SECRET_FIELD = "agent_secret_{agent_id}"

    def __init__(self, *, neon_vault: Any, runtime: Any) -> None:
        self._neon = neon_vault
        self._runtime = runtime
        # The SDK's own cipher, keyed from the operator's nsec — never a local
        # one. None when the vault was built without an nsec, and then nothing
        # that must be encrypted is stored at all.
        self._cipher = getattr(neon_vault, "_cipher", None)

    async def _put_secret(self, npub: str, agent_id: str, secret: str) -> None:
        await self._runtime.update_patron_credential(
            npub, self.SECRET_FIELD.format(agent_id=agent_id), secret)

    async def _get_secret(self, npub: str, agent_id: str) -> str | None:
        return await self._runtime.get_patron_credential(
            npub, self.SECRET_FIELD.format(agent_id=agent_id))

    def _t(self, table: str) -> str:
        return self._neon._t(table)

    async def ensure_schema(self) -> None:
        await self._neon._execute(
            f"CREATE TABLE IF NOT EXISTS {self._t('chart_agents')} ("
            "    agent_id TEXT PRIMARY KEY,"
            "    npub TEXT NOT NULL,"
            "    label TEXT NOT NULL,"
            "    paired_at TIMESTAMPTZ DEFAULT now(),"
            "    last_seen TIMESTAMPTZ"
            ")"
        )
        await self._neon._execute(
            "CREATE INDEX IF NOT EXISTS idx_chart_agents_npub "
            f"ON {self._t('chart_agents')} (npub)"
        )
        await self._neon._execute(
            f"CREATE TABLE IF NOT EXISTS {self._t('chart_pairings')} ("
            "    code TEXT PRIMARY KEY,"
            "    created_at TIMESTAMPTZ DEFAULT now(),"
            "    agent_id TEXT,"
            "    collected_at TIMESTAMPTZ"
            ")"
        )
        # chart_pairings predates collected_at, and CREATE TABLE IF NOT EXISTS
        # leaves an existing table untouched - so the column has to be added
        # explicitly or every collect against an already-deployed database
        # fails on an unknown column.
        await self._neon._execute(
            f"ALTER TABLE {self._t('chart_pairings')} "
            "ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ")
        await self._neon._execute(
            f"CREATE TABLE IF NOT EXISTS {self._t('chart_commands')} ("
            "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"
            "    agent_id TEXT NOT NULL,"
            "    command TEXT NOT NULL,"
            "    reply TEXT,"
            "    created_at TIMESTAMPTZ DEFAULT now(),"
            "    claimed_at TIMESTAMPTZ,"
            "    done_at TIMESTAMPTZ"
            ")"
        )
        await self._neon._execute(
            "CREATE INDEX IF NOT EXISTS idx_chart_commands_pending "
            f"ON {self._t('chart_commands')} (agent_id, claimed_at)"
        )
        # The newest picture of each symbol a display has shown, sealed.
        # taken_at stays in the clear so "which is newest?" and the hourly
        # sweep never need a decrypt.
        await self._neon._execute(
            f"CREATE TABLE IF NOT EXISTS {self._t('chart_pictures')} ("
            "    agent_id TEXT NOT NULL,"
            "    symbol TEXT NOT NULL,"
            "    taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
            "    image TEXT NOT NULL,"
            "    PRIMARY KEY (agent_id, symbol)"
            ")"
        )
        # Migration: scale arrived after chart_pictures did. Metadata like
        # symbol and taken_at, so it is kept in the clear. Idempotent.
        await self._neon._execute(
            f"ALTER TABLE {self._t('chart_pictures')} "
            "ADD COLUMN IF NOT EXISTS scale TEXT")
        # Migration: chart_pictures replaces chart_latest, which kept one
        # picture per display. Those pictures are disposable - sealed, and
        # gone within the hour anyway - so the old table is dropped rather
        # than copied. Idempotent: once it is gone this does nothing.
        await self._neon._execute(f"DROP TABLE IF EXISTS {self._t('chart_latest')}")

    # -- pairing ---------------------------------------------------------

    async def open_code(self) -> str:
        await self._sweep()
        code = new_pairing_code()
        await self._neon._execute(
            f"INSERT INTO {self._t('chart_pairings')} (code) VALUES ($1)", [code])
        return code

    async def claim(self, code: str, npub: str, label: str) -> Agent:
        code = code.strip().upper()
        result = await self._neon._execute(
            f"SELECT code, agent_id, EXTRACT(EPOCH FROM created_at) AS created "
            f"FROM {self._t('chart_pairings')} WHERE code = $1", [code])
        rows = result.get("rows", [])
        if not rows:
            raise KeyError("unknown or expired pairing code")
        row = rows[0]
        if row.get("agent_id"):
            raise KeyError("pairing code already used")
        if (time.time() - float(row.get("created") or 0)) > CODE_TTL_SECONDS:
            raise KeyError("unknown or expired pairing code")

        agent = Agent(agent_id=new_agent_id(), npub=npub,
                      label=label or "display", secret=new_secret())
        await self._neon._execute(
            f"INSERT INTO {self._t('chart_agents')} "
            "(agent_id, npub, label) VALUES ($1, $2, $3)",
            [agent.agent_id, agent.npub, agent.label])
        await self._put_secret(agent.npub, agent.agent_id, agent.secret)
        await self._neon._execute(
            f"UPDATE {self._t('chart_pairings')} SET agent_id = $1 WHERE code = $2",
            [agent.agent_id, code])
        return agent

    async def collect(self, code: str) -> tuple[str, str] | None:
        code = code.strip().upper()
        result = await self._neon._execute(
            f"SELECT p.agent_id, a.npub FROM {self._t('chart_pairings')} p "
            f"LEFT JOIN {self._t('chart_agents')} a ON a.agent_id = p.agent_id "
            "WHERE p.code = $1", [code])
        rows = result.get("rows", [])
        if not rows or not rows[0].get("agent_id"):
            return None
        agent_id, npub = rows[0]["agent_id"], rows[0]["npub"]
        secret = await self._get_secret(npub, agent_id)
        # Deliberately NOT deleted here. Collect must be idempotent: the
        # first call after a deploy is cold - vault bootstrap plus schema
        # creation - and can outrun a client read timeout. Deleting on read
        # means the server consumes the handshake into a response nobody
        # receives, and the secret is gone for good. The row expires on the
        # same TTL the code already had, so this widens no window.
        await self._neon._execute(
            f"UPDATE {self._t('chart_pairings')} SET collected_at = now() "
            "WHERE code = $1 AND collected_at IS NULL", [code])
        return agent_id, secret or ""

    async def _sweep(self) -> None:
        await self._neon._execute(
            f"DELETE FROM {self._t('chart_pairings')} "
            f"WHERE created_at < now() - interval '{CODE_TTL_SECONDS} seconds'")

    # -- lookup ----------------------------------------------------------

    async def authenticate(self, agent_id: str, secret: str) -> Agent | None:
        result = await self._neon._execute(
            f"SELECT agent_id, npub, label, EXTRACT(EPOCH FROM last_seen) AS seen "
            f"FROM {self._t('chart_agents')} WHERE agent_id = $1", [agent_id])
        rows = result.get("rows", [])
        if not rows:
            return None
        row = rows[0]
        known = await self._get_secret(row["npub"], row["agent_id"])
        if not known or not secrets.compare_digest(known, secret):
            return None
        return Agent(agent_id=row["agent_id"], npub=row["npub"], label=row["label"],
                     secret="", last_seen=float(row.get("seen") or 0))

    async def touch(self, agent_id: str) -> None:
        await self._neon._execute(
            f"UPDATE {self._t('chart_agents')} SET last_seen = now() WHERE agent_id = $1",
            [agent_id])

    async def for_npub(self, npub: str) -> list[Agent]:
        result = await self._neon._execute(
            f"SELECT agent_id, npub, label, EXTRACT(EPOCH FROM last_seen) AS seen "
            f"FROM {self._t('chart_agents')} WHERE npub = $1 ORDER BY paired_at",
            [npub])
        # Secrets are deliberately absent: listing displays must never
        # require reading credentials.
        return [Agent(agent_id=r["agent_id"], npub=r["npub"], label=r["label"],
                      secret="", last_seen=float(r.get("seen") or 0))
                for r in result.get("rows", [])]

    async def resolve(self, npub: str, display: str | None) -> Agent:
        """One of ``npub``'s displays, by agent_id or by name - never anyone else's.

        A name is matched loosely by :func:`displays.match` ("mini mac" and
        "mini" both find "Mac mini"). Omitted, it means the only display
        there is. Raises NoSuchDisplay when nothing matches and
        AmbiguousDisplay when several do and it is not the case that exactly
        one of them is live.
        """
        owned = await self.for_npub(npub)
        if not owned:
            raise LookupError("no agent paired to this npub")
        if not display:
            if len(owned) > 1:
                raise LookupError("several displays are paired - name one: "
                                  + ", ".join(a.label for a in owned))
            return owned[0]
        named = set(displays.match(display, [a.label for a in owned]))
        match = [a for a in owned if a.agent_id == display.strip()] or [
            a for a in owned if a.label in named]
        if not match:
            raise NoSuchDisplay(display, owned)
        if len(match) == 1:
            return match[0]
        # Re-pairing leaves the old row behind under the same name, and a
        # loose name can find several. The live one is the one the caller
        # means - but only when there is exactly one.
        live = [a for a in match if a.connected()]
        if len(live) == 1:
            return live[0]
        raise AmbiguousDisplay(display, match)

    async def forget(self, npub: str, display: str) -> Agent:
        """Remove one of the caller's displays, and everything it left behind.

        Only ever the caller's own: the display is looked up among the rows
        paired to ``npub``, never by id alone. A name shared by several rows
        is refused rather than guessed - forgetting is not undoable, so the
        caller names the one they mean by its id.
        """
        owned = await self.for_npub(npub)
        wanted = display.strip()
        match = [a for a in owned if a.agent_id == wanted] or [
            a for a in owned if a.label.lower() == wanted.lower()]
        if not match:
            raise LookupError(f"no display named {display!r}")
        if len(match) > 1:
            raise LookupError(
                f"several displays are named {display!r} - name one by id: "
                + ", ".join(a.agent_id for a in match))
        agent = match[0]
        for table in ("chart_commands", "chart_pairings", "chart_pictures"):
            await self._neon._execute(
                f"DELETE FROM {self._t(table)} WHERE agent_id = $1", [agent.agent_id])
        await self._neon._execute(
            f"DELETE FROM {self._t('chart_agents')} WHERE agent_id = $1 AND npub = $2",
            [agent.agent_id, npub])
        await self._runtime.delete_patron_credential(
            npub, self.SECRET_FIELD.format(agent_id=agent.agent_id))
        return agent

    # -- kept pictures ---------------------------------------------------
    #
    # A chart picture can carry what the patron has on screen, so it is kept
    # only sealed, only the newest per symbol, for at most LATEST_KEEP
    # symbols per display, and each only for an hour. AAD binds a ciphertext
    # to its display AND its symbol: a row copied onto another display, or
    # relabelled as another symbol, will not open.

    @staticmethod
    def _latest_aad(agent_id: str, symbol: str) -> str:
        return f"{agent_id}|latest|{symbol}"

    async def _sweep_pictures(self) -> None:
        await self._neon._execute(
            f"DELETE FROM {self._t('chart_pictures')} "
            f"WHERE taken_at <= now() - interval '{LATEST_TTL_SECONDS} seconds'")

    async def keep_latest(self, agent_id: str, data_url: str, symbol: str = "",
                          scale: str | None = None) -> None:
        """Keep a display's picture of one symbol, replacing that symbol's last.

        Only the display's LATEST_KEEP most recent symbols survive. Refuses
        when the picture cannot be sealed, and when ``symbol`` is not
        symbol-shaped (ValueError). ``scale`` is the time frame the display
        stated; one that is not scale-shaped is dropped, not refused.
        """
        key = symbol_key(symbol)
        scaled = scale_label(scale)
        if self._cipher is None:
            raise RuntimeError("no vault cipher: a picture is never stored in the clear")
        sealed = self._cipher.encrypt(data_url, aad=self._latest_aad(agent_id, key))
        table = self._t("chart_pictures")
        await self._neon._execute(
            f"INSERT INTO {table} (agent_id, symbol, image, scale, taken_at) "
            "VALUES ($1, $2, $3, $4, now()) "
            "ON CONFLICT (agent_id, symbol) "
            "DO UPDATE SET image = EXCLUDED.image, scale = EXCLUDED.scale, taken_at = now()",
            [agent_id, key, sealed, scaled])
        await self._neon._execute(
            f"DELETE FROM {table} WHERE agent_id = $1 AND symbol NOT IN ("
            f"    SELECT symbol FROM {table} WHERE agent_id = $1 "
            f"    ORDER BY taken_at DESC LIMIT {LATEST_KEEP})",
            [agent_id])

    async def kept_symbols(self, npub: str) -> dict[str, list[tuple[str, float]]]:
        """Per display of the caller's, the symbols still kept, newest first."""
        result = await self._neon._execute(
            f"SELECT l.agent_id, l.symbol, EXTRACT(EPOCH FROM l.taken_at) AS taken "
            f"FROM {self._t('chart_pictures')} l "
            f"JOIN {self._t('chart_agents')} a ON a.agent_id = l.agent_id "
            f"WHERE a.npub = $1 AND l.taken_at > now() - interval '{LATEST_TTL_SECONDS} seconds' "
            "ORDER BY l.taken_at DESC",
            [npub])
        kept: dict[str, list[tuple[str, float]]] = {}
        for r in result.get("rows", []):
            kept.setdefault(r["agent_id"], []).append((r["symbol"], float(r["taken"])))
        return kept

    async def latest(self, agent_id: str,
                     symbol: str | None = None) -> KeptPicture | None:
        """A display's kept picture, or None.

        ``symbol`` None or empty means the display's newest picture of any
        symbol; otherwise that symbol's (case-insensitive). Pictures past
        their hour are deleted here rather than shown.
        """
        await self._sweep_pictures()
        table = self._t("chart_pictures")
        if symbol:
            result = await self._neon._execute(
                f"SELECT symbol, image, scale, EXTRACT(EPOCH FROM taken_at) AS taken "
                f"FROM {table} WHERE agent_id = $1 AND symbol = $2",
                [agent_id, symbol_key(symbol)])
        else:
            result = await self._neon._execute(
                f"SELECT symbol, image, scale, EXTRACT(EPOCH FROM taken_at) AS taken "
                f"FROM {table} WHERE agent_id = $1 ORDER BY taken_at DESC LIMIT 1",
                [agent_id])
        rows = result.get("rows", [])
        if not rows or self._cipher is None:
            return None
        row = rows[0]
        key = row["symbol"]
        data_url = self._cipher.decrypt(row["image"], aad=self._latest_aad(agent_id, key))
        return KeptPicture(data_url, float(row["taken"]), key, scale_label(row.get("scale")))

    # -- command bus -----------------------------------------------------

    async def send(self, agent_id: str, command: str,
                   timeout: float = COMMAND_TIMEOUT_SECONDS) -> str:
        """Queue a command and wait for the agent's reply.

        Raises TimeoutError when nothing answers, which the caller must
        treat as a failure and refund. The row is deleted either way: a
        chart command is only meaningful now, and a stale one must never
        surface later when an agent reconnects.
        """
        result = await self._neon._execute(
            f"INSERT INTO {self._t('chart_commands')} (agent_id, command) "
            "VALUES ($1, $2) RETURNING id", [agent_id, command])
        rows = result.get("rows", [])
        if not rows:
            raise RuntimeError("could not queue the command")
        request_id = rows[0]["id"]

        deadline = time.time() + timeout
        try:
            while time.time() < deadline:
                await asyncio.sleep(RESULT_POLL_SECONDS)
                got = await self._neon._execute(
                    f"SELECT reply FROM {self._t('chart_commands')} "
                    "WHERE id = $1 AND done_at IS NOT NULL", [request_id])
                found = got.get("rows", [])
                if found:
                    return str(found[0].get("reply") or "")
            raise TimeoutError("the display did not answer")
        finally:
            await self._neon._execute(
                f"DELETE FROM {self._t('chart_commands')} WHERE id = $1", [request_id])

    async def next_for(self, agent_id: str, timeout: float) -> dict | None:
        """Claim the oldest unclaimed command for an agent, if one arrives."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            result = await self._neon._execute(
                f"UPDATE {self._t('chart_commands')} SET claimed_at = now() "
                "WHERE id = ("
                f"    SELECT id FROM {self._t('chart_commands')} "
                "    WHERE agent_id = $1 AND claimed_at IS NULL "
                "    ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED"
                ") RETURNING id, command", [agent_id])
            rows = result.get("rows", [])
            if rows:
                return {"id": str(rows[0]["id"]), "command": rows[0]["command"]}
            await asyncio.sleep(CLAIM_POLL_SECONDS)
        return None

    async def deliver(self, request_id: str, reply: str) -> bool:
        result = await self._neon._execute(
            f"UPDATE {self._t('chart_commands')} SET reply = $1, done_at = now() "
            "WHERE id = $2 AND done_at IS NULL RETURNING id", [reply, request_id])
        return bool(result.get("rows"))
