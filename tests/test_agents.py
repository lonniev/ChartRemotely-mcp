"""Identities, and the decisions the store makes around them."""

import time

import pytest

from chartremotely_mcp import agents
from chartremotely_mcp.store import AgentStore


def test_pairing_code_avoids_ambiguous_glyphs():
    """Codes get read aloud or typed off a screen across the room, so the
    pairs people confuse must not appear."""
    code = agents.new_pairing_code()
    assert len(code) == agents.CODE_LENGTH
    assert not set(code) & set("01IO")


def test_connected_is_derived_from_the_last_poll():
    """A dropped connection is indistinguishable from a slow one, so only
    recency answers the question a caller actually has."""
    agent = agents.Agent(agent_id="a1", npub="npub1x", label="wall", secret="")
    assert not agent.connected()
    agent.last_seen = time.time()
    assert agent.connected()


class FakeRuntime:
    """Stands in for the wheel's patron credential vault."""

    def __init__(self):
        self.creds: dict[tuple[str, str], str] = {}

    async def update_patron_credential(self, npub, field, value, *, service=None):
        self.creds[(npub, field)] = value
        return True

    async def get_patron_credential(self, npub, field, *, service=None):
        return self.creds.get((npub, field))


class FakeNeon:
    """Answers with whatever a test queues, and records what was asked."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.sql: list[str] = []

    def _t(self, table):
        return f"op.{table}"

    async def _execute(self, sql, params=None):
        self.sql.append(sql)
        return self.responses.pop(0) if self.responses else {"rows": []}


def store(*responses, runtime=None):
    return AgentStore(neon_vault=FakeNeon(*responses),
                      runtime=runtime or FakeRuntime())


async def test_no_secret_is_ever_written_to_a_column():
    """The whole point of using the wheel's vault: nothing sensitive should
    appear in SQL this module emits."""
    runtime = FakeRuntime()
    neon = FakeNeon({"rows": [{"code": "ABC234", "agent_id": None, "created": time.time()}]})
    agent_store = AgentStore(neon_vault=neon, runtime=runtime)
    agent = await agent_store.claim("ABC234", "npub1alice", "east wall")

    assert all("secret" not in sql.lower() for sql in neon.sql)
    assert runtime.creds[("npub1alice", f"agent_secret_{agent.agent_id}")] == agent.secret


async def test_a_used_code_is_refused():
    s = store({"rows": [{"code": "ABC234", "agent_id": "taken", "created": time.time()}]})
    with pytest.raises(KeyError, match="already used"):
        await s.claim("ABC234", "npub1mallory", "mine now")


async def test_an_expired_code_is_refused():
    stale = time.time() - agents.CODE_TTL_SECONDS - 1
    s = store({"rows": [{"code": "ABC234", "agent_id": None, "created": stale}]})
    with pytest.raises(KeyError, match="expired"):
        await s.claim("ABC234", "npub1alice", "wall")


async def test_an_unknown_code_is_refused():
    s = store({"rows": []})
    with pytest.raises(KeyError):
        await s.claim("ZZZZZZ", "npub1alice", "wall")


async def test_authentication_reads_the_secret_from_the_vault():
    runtime = FakeRuntime()
    runtime.creds[("npub1alice", "agent_secret_a1")] = "right"
    rows = {"rows": [{"agent_id": "a1", "npub": "npub1alice", "label": "wall", "seen": 0}]}

    good = AgentStore(neon_vault=FakeNeon(rows), runtime=runtime)
    assert await good.authenticate("a1", "right") is not None

    bad = AgentStore(neon_vault=FakeNeon(rows), runtime=runtime)
    assert await bad.authenticate("a1", "wrong") is None


async def test_authentication_fails_closed_when_no_credential_exists():
    rows = {"rows": [{"agent_id": "a1", "npub": "npub1alice", "label": "wall", "seen": 0}]}
    s = AgentStore(neon_vault=FakeNeon(rows), runtime=FakeRuntime())
    assert await s.authenticate("a1", "anything") is None


async def test_listing_displays_never_reads_credentials():
    runtime = FakeRuntime()
    rows = {"rows": [{"agent_id": "a1", "npub": "npub1alice", "label": "wall", "seen": 0}]}
    s = AgentStore(neon_vault=FakeNeon(rows), runtime=runtime)
    listed = await s.for_npub("npub1alice")
    assert [a.secret for a in listed] == [""]


async def test_one_display_needs_no_name_and_several_do(monkeypatch):
    s = store()
    east = agents.Agent(agent_id="a1", npub="n", label="east wall", secret="")
    desk = agents.Agent(agent_id="a2", npub="n", label="desk", secret="")

    async def only_east(npub): return [east]
    monkeypatch.setattr(s, "for_npub", only_east)
    assert await s.resolve("n", None) is east

    async def both(npub): return [east, desk]
    monkeypatch.setattr(s, "for_npub", both)
    with pytest.raises(LookupError, match="name one"):
        await s.resolve("n", None)
    assert await s.resolve("n", "east wall") is east


async def test_an_unpaired_npub_is_refused(monkeypatch):
    s = store()

    async def none(npub): return []
    monkeypatch.setattr(s, "for_npub", none)
    with pytest.raises(LookupError, match="no agent paired"):
        await s.resolve("npub1stranger", None)


async def test_nothing_is_queued_for_an_absent_agent():
    """A chart command is only meaningful now. Timing out is correct, and
    the row is removed so it cannot surface later on reconnect."""
    neon = FakeNeon({"rows": [{"id": "r1"}]})
    s = AgentStore(neon_vault=neon, runtime=FakeRuntime())
    with pytest.raises(TimeoutError):
        await s.send("offline", "read", timeout=0.05)
    assert any(sql.startswith("DELETE") for sql in neon.sql)


async def test_the_store_needs_a_real_vault_not_the_accessor():
    """runtime.vault is a coroutine, not a property.

    Passing the bound method gives the store an object with no _execute,
    which imports cleanly and then 500s on the first request - exactly how
    this shipped once.
    """
    import inspect

    from tollbooth.runtime import OperatorRuntime
    assert inspect.iscoroutinefunction(OperatorRuntime.vault), (
        "if vault ever becomes a property, server.py must stop awaiting it")


async def test_collect_is_idempotent_and_never_destroys_the_pairing():
    """A read that consumes the credential is only safe if delivery is
    guaranteed, and over a network it never is. The agent's first collect
    can time out while the server succeeds; the retry has to still work."""
    runtime = FakeRuntime()
    runtime.creds[("npub1alice", "agent_secret_a1")] = "s3cret"
    paired = {"rows": [{"agent_id": "a1", "npub": "npub1alice"}]}
    neon = FakeNeon(paired, {"rows": []}, paired, {"rows": []})
    s = AgentStore(neon_vault=neon, runtime=runtime)

    first = await s.collect("ABC234")
    second = await s.collect("ABC234")

    assert first == ("a1", "s3cret")
    assert second == first
    assert not any("DELETE" in sql.upper() for sql in neon.sql)


async def test_schema_adds_collected_at_to_an_existing_table():
    """CREATE TABLE IF NOT EXISTS is a no-op against a table that predates
    the column, so the migration has to be explicit."""
    neon = FakeNeon()
    await AgentStore(neon_vault=neon, runtime=FakeRuntime()).ensure_schema()

    assert any("ADD COLUMN IF NOT EXISTS collected_at" in sql for sql in neon.sql)
