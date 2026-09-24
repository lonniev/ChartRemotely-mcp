"""Identities, and the decisions the store makes around them."""

import time

import pytest
from cryptography.exceptions import InvalidTag
from tollbooth.vault_encryption import VaultCipher

from chartremotely_mcp import agents
from chartremotely_mcp.store import AgentStore, AmbiguousDisplay, NoSuchDisplay


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


async def test_a_shared_name_goes_to_the_live_display(monkeypatch):
    """Re-pairing leaves the old row behind under the same name; a command
    must reach the machine that is actually listening."""
    s = store()
    stale = agents.Agent(agent_id="old", npub="npub1x", label="display", secret="")
    live = agents.Agent(agent_id="new", npub="npub1x", label="display", secret="",
                        last_seen=time.time())

    async def both(npub): return [stale, live]
    monkeypatch.setattr(s, "for_npub", both)
    assert (await s.resolve("npub1x", "display")).agent_id == "new"


class ForgettingRuntime(FakeRuntime):
    async def delete_patron_credential(self, npub, field, *, service=None):
        return self.creds.pop((npub, field), None) is not None


async def test_forget_clears_every_trace_including_the_vault_secret(monkeypatch):
    runtime = ForgettingRuntime()
    runtime.creds[("npub1x", "agent_secret_a1")] = "s3cret"
    s = store(runtime=runtime)
    desk = agents.Agent(agent_id="a1", npub="npub1x", label="desk", secret="")

    async def mine(npub): return [desk] if npub == "npub1x" else []
    monkeypatch.setattr(s, "for_npub", mine)

    assert (await s.forget("npub1x", "Desk")).agent_id == "a1"
    deletes = [q for q in s._neon.sql if q.startswith("DELETE")]
    assert {q.split()[2] for q in deletes} == {
        "op.chart_commands", "op.chart_pairings", "op.chart_pictures", "op.chart_agents"}
    # The agents row is deleted only when it belongs to the caller.
    assert "npub = $2" in next(q for q in deletes if "chart_agents" in q)
    assert runtime.creds == {}


async def test_forget_never_reaches_another_patrons_display(monkeypatch):
    s = store()

    async def mine(npub): return []
    monkeypatch.setattr(s, "for_npub", mine)
    with pytest.raises(LookupError):
        await s.forget("npub1intruder", "a1")
    assert s._neon.sql == []


async def test_forget_refuses_to_guess_between_displays_sharing_a_name(monkeypatch):
    s = store(runtime=ForgettingRuntime())
    twins = [agents.Agent(agent_id=i, npub="npub1x", label="display", secret="")
             for i in ("a1", "a2")]

    async def mine(npub): return twins
    monkeypatch.setattr(s, "for_npub", mine)
    with pytest.raises(LookupError, match="a1, a2"):
        await s.forget("npub1x", "display")
    # Naming one by id works.
    assert (await s.forget("npub1x", "a2")).agent_id == "a2"


# -- the latest picture ------------------------------------------------------

PICTURE = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="


def sealed_store(*responses):
    neon = FakeNeon(*responses)
    neon._cipher = VaultCipher(nsec_hex="11" * 32)
    return AgentStore(neon_vault=neon, runtime=FakeRuntime()), neon


class Recording(FakeNeon):
    async def _execute(self, sql, params=None):
        self.params = getattr(self, "params", []) + [params]
        return await super()._execute(sql, params)


async def test_a_kept_picture_is_stored_sealed_never_in_the_clear():
    neon = Recording()
    neon._cipher = VaultCipher(nsec_hex="11" * 32)
    s = AgentStore(neon_vault=neon, runtime=FakeRuntime())
    await s.keep_latest("a1", PICTURE, "PLTR")
    agent_id, symbol, stored = neon.params[0]
    assert (agent_id, symbol) == ("a1", "PLTR")
    assert "data:image" not in stored and "/9j/" not in stored
    assert neon._cipher.decrypt(stored, aad="a1|latest|PLTR") == PICTURE


async def test_without_a_cipher_nothing_is_stored():
    s = store()
    with pytest.raises(RuntimeError):
        await s.keep_latest("a1", PICTURE, "PLTR")
    assert s._neon.sql == []


async def test_each_symbol_is_kept_under_its_own_key_upper_cased():
    neon = Recording()
    neon._cipher = VaultCipher(nsec_hex="11" * 32)
    s = AgentStore(neon_vault=neon, runtime=FakeRuntime())
    await s.keep_latest("a1", PICTURE, " pltr ")
    assert "ON CONFLICT (agent_id, symbol)" in neon.sql[0]
    assert neon.params[0][1] == "PLTR"


async def test_a_picture_without_a_symbol_is_kept_as_chart_not_dropped():
    neon = Recording()
    neon._cipher = VaultCipher(nsec_hex="11" * 32)
    s = AgentStore(neon_vault=neon, runtime=FakeRuntime())
    await s.keep_latest("a1", PICTURE)
    assert neon.params[0][1] == agents.UNLABELLED
    assert agents.symbol_name(agents.UNLABELLED) == "Chart"


async def test_only_the_twelve_most_recent_symbols_survive_a_keep():
    neon = Recording()
    neon._cipher = VaultCipher(nsec_hex="11" * 32)
    s = AgentStore(neon_vault=neon, runtime=FakeRuntime())
    await s.keep_latest("a1", PICTURE, "PLTR")
    cap = neon.sql[1]
    assert cap.startswith("DELETE FROM op.chart_pictures WHERE agent_id = $1")
    assert "ORDER BY taken_at DESC LIMIT 12" in cap
    assert neon.params[1] == ["a1"], "the cap only ever trims this display's rows"
    assert agents.LATEST_KEEP == 12


@pytest.mark.parametrize("bad", ["TOO-LONG-A-SYMBOL", "PL TR", "<script>", "PLTR;--", "ÆBC", 7])
async def test_a_symbol_that_is_not_symbol_shaped_is_refused_before_anything_is_stored(bad):
    s, neon = sealed_store()
    with pytest.raises(ValueError):
        await s.keep_latest("a1", PICTURE, bad)
    assert neon.sql == []


@pytest.mark.parametrize("good", ["/ES", ".SPX", "$SPX.X", "^VIX", "BRK/B", "BRK-B", "a"])
def test_futures_indices_and_share_classes_are_symbols(good):
    assert agents.symbol_key(good) == good.upper()


async def test_a_picture_sealed_for_one_display_will_not_open_as_another():
    s, neon = sealed_store()
    sealed = neon._cipher.encrypt(PICTURE, aad="a1|latest|PLTR")
    neon.responses = [{"rows": []},
                      {"rows": [{"symbol": "PLTR", "image": sealed, "taken": time.time()}]}]
    with pytest.raises(InvalidTag):
        await s.latest("b2", "PLTR")


async def test_a_picture_relabelled_as_another_symbol_will_not_open():
    s, neon = sealed_store()
    sealed = neon._cipher.encrypt(PICTURE, aad="a1|latest|PLTR")
    neon.responses = [{"rows": []},
                      {"rows": [{"symbol": "NVDA", "image": sealed, "taken": time.time()}]}]
    with pytest.raises(InvalidTag):
        await s.latest("a1", "NVDA")


async def test_a_symbols_picture_opens_asked_for_in_any_case():
    s, neon = sealed_store()
    sealed = neon._cipher.encrypt(PICTURE, aad="a1|latest|PLTR")
    neon = Recording({"rows": []},
                     {"rows": [{"symbol": "PLTR", "image": sealed, "taken": 1700000000.0}]})
    neon._cipher = VaultCipher(nsec_hex="11" * 32)
    s = AgentStore(neon_vault=neon, runtime=FakeRuntime())
    assert await s.latest("a1", "pltr") == (PICTURE, 1700000000.0, "PLTR")
    assert neon.params[1] == ["a1", "PLTR"]
    # Pictures past their hour are swept before anything is read.
    assert neon.sql[0].startswith("DELETE FROM op.chart_pictures WHERE taken_at <=")


async def test_no_symbol_means_the_displays_newest_picture():
    s, neon = sealed_store()
    sealed = neon._cipher.encrypt(PICTURE, aad="a1|latest|NVDA")
    neon.responses = [{"rows": []},
                      {"rows": [{"symbol": "NVDA", "image": sealed, "taken": 1700000000.0}]}]
    assert await s.latest("a1") == (PICTURE, 1700000000.0, "NVDA")
    assert "ORDER BY taken_at DESC LIMIT 1" in neon.sql[1]


async def test_nothing_kept_reads_as_none():
    s, _ = sealed_store()
    assert await s.latest("a1") is None
    assert await s.latest("a1", "PLTR") is None


async def test_kept_symbols_are_the_callers_own_newest_first_and_unexpired():
    s, neon = sealed_store({"rows": [
        {"agent_id": "a1", "symbol": "NVDA", "taken": 1700000100.0},
        {"agent_id": "a1", "symbol": "PLTR", "taken": 1700000000.0},
        {"agent_id": "b2", "symbol": "-", "taken": 1700000050.0},
    ]})
    assert await s.kept_symbols("npub1x") == {
        "a1": [("NVDA", 1700000100.0), ("PLTR", 1700000000.0)],
        "b2": [("-", 1700000050.0)],
    }
    q = neon.sql[0]
    assert "a.npub = $1" in q and "taken_at > now()" in q and "ORDER BY l.taken_at DESC" in q


async def test_the_migration_replaces_the_one_picture_table_and_is_idempotent():
    s = store()
    await s.ensure_schema()
    await s.ensure_schema()
    ddl = s._neon.sql
    assert ddl.count("DROP TABLE IF EXISTS op.chart_latest") == 2
    creates = [q for q in ddl if "CREATE TABLE IF NOT EXISTS op.chart_pictures" in q]
    assert len(creates) == 2 and "PRIMARY KEY (agent_id, symbol)" in creates[0]


# -- naming a display ----------------------------------------------------------

@pytest.mark.parametrize("said", ["Mac mini", "mac-mini", "macmini", "MAC_MINI", "mac.mini", "  Mac  Mini "])
def test_spaces_hyphens_underscores_dots_and_case_do_not_count(said):
    assert agents.display_key(said) == agents.display_key("Mac Mini") == "macmini"


@pytest.mark.parametrize("said", ["mac", "mini mac", "Mac min", "macminis"])
def test_nothing_else_is_forgiven(said):
    assert agents.display_key(said) != agents.display_key("Mac Mini")


async def test_a_display_is_found_by_its_normalised_name_or_its_id(monkeypatch):
    s = store()
    mini = agents.Agent(agent_id="a1", npub="n", label="Mac Mini", secret="")
    desk = agents.Agent(agent_id="a2", npub="n", label="desk", secret="")

    async def both(npub): return [mini, desk]
    monkeypatch.setattr(s, "for_npub", both)
    assert await s.resolve("n", "mac-mini") is mini
    assert await s.resolve("n", "a2") is desk
    with pytest.raises(NoSuchDisplay) as caught:
        await s.resolve("n", "kitchen")
    assert caught.value.names == ["Mac Mini", "desk"]


async def test_twins_with_no_single_live_one_are_refused_not_guessed(monkeypatch):
    s = store()
    twins = [agents.Agent(agent_id=i, npub="n", label="desk", secret="") for i in ("a1", "a2")]

    async def mine(npub): return twins
    monkeypatch.setattr(s, "for_npub", mine)
    with pytest.raises(AmbiguousDisplay, match="a1, a2"):
        await s.resolve("n", "Desk")
