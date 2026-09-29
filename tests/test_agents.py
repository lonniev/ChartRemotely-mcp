"""Identities, and the decisions the store makes around them."""

import time

import pytest
from cryptography.exceptions import InvalidTag
from tollbooth.vault_encryption import VaultCipher

from chartremotely_mcp import agents
from chartremotely_mcp.store import AgentStore, AmbiguousDisplay, NoSuchDisplay

from .sqlite_neon import SqliteNeon


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
        "op.chart_commands", "op.chart_pairings", "op.chart_captures", "op.chart_agents"}
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


# -- kept captures -----------------------------------------------------------

PICTURE = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
CIPHER = VaultCipher(nsec_hex="11" * 32)


def sealed_store(*responses):
    neon = FakeNeon(*responses)
    neon._cipher = CIPHER
    return AgentStore(neon_vault=neon, runtime=FakeRuntime()), neon


async def live_store():
    """A store on a database that runs its SQL, one display a1 of npub1x's."""
    neon = SqliteNeon(cipher=CIPHER)
    s = AgentStore(neon_vault=neon, runtime=FakeRuntime())
    await s.ensure_schema()
    await neon._execute("INSERT INTO op.chart_agents (agent_id, npub, label) VALUES ($1, $2, $3)",
                        ["a1", "npub1x", "desk"])
    return s, neon


async def keep(s, neon, symbol, n=1, scale=None, step=60.0):
    """Keep n captures of symbol, the clock moving on between each."""
    ids = []
    for _ in range(n):
        neon.clock += step
        ids.append(await s.keep_capture("a1", PICTURE, symbol, scale))
    return ids


async def test_a_capture_is_stored_sealed_never_in_the_clear():
    s, neon = await live_store()
    [cid] = await keep(s, neon, "PLTR", scale="half")
    [row] = neon.rows("chart_captures")
    assert (row["agent_id"], row["symbol"], row["scale"], row["capture_id"]) == ("a1", "PLTR", "half", cid)
    assert "data:image" not in row["image"] and "/9j/" not in row["image"]
    assert CIPHER.decrypt(row["image"], aad=f"a1|latest|PLTR|{cid}") == PICTURE


async def test_capture_ids_are_fresh_hex_and_the_only_shape_accepted():
    s, neon = await live_store()
    ids = await keep(s, neon, "PLTR", 3)
    assert len(set(ids)) == 3 and all(agents.capture_key(i) == i for i in ids)
    for bad in ["", "ABCDEF0123456789", "0123", "0" * 17, "0123456789abcdeg", "' OR 1=1 --", 7, None]:
        with pytest.raises(ValueError):
            agents.capture_key(bad)


async def test_without_a_cipher_nothing_is_stored():
    s = store()
    with pytest.raises(RuntimeError):
        await s.keep_capture("a1", PICTURE, "PLTR")
    assert s._neon.sql == []


async def test_a_seventh_capture_drops_that_symbols_oldest():
    s, neon = await live_store()
    ids = await keep(s, neon, "PLTR", 7)
    [pltr] = (await s.kept_captures("npub1x"))["a1"]
    assert [c.capture for c in pltr.captures] == ids[:0:-1], "the six newest, newest first"
    assert agents.CAPTURES_PER_SYMBOL == 6


async def test_one_symbols_captures_never_crowd_out_anothers():
    s, neon = await live_store()
    [nvda] = await keep(s, neon, "NVDA")
    await keep(s, neon, "PLTR", 8)
    kept = {k.symbol: [c.capture for c in k.captures] for k in (await s.kept_captures("npub1x"))["a1"]}
    assert kept["NVDA"] == [nvda] and len(kept["PLTR"]) == 6


async def test_a_twenty_first_symbol_drops_the_symbol_idle_longest_with_all_its_captures():
    s, neon = await live_store()
    await keep(s, neon, "OLD", 3)
    for i in range(19):
        await keep(s, neon, f"S{i}")
    await keep(s, neon, "OLD")      # OLD is fresh again: S0 is now idle longest
    await keep(s, neon, "NEW")      # the twenty-first symbol
    symbols = [k.symbol for k in (await s.kept_captures("npub1x"))["a1"]]
    assert len(symbols) == 20 and "S0" not in symbols
    assert symbols[:2] == ["NEW", "OLD"], "by newest activity"
    assert not [r for r in neon.rows("chart_captures") if r["symbol"] == "S0"]
    assert agents.SYMBOLS_KEPT == 20


async def test_the_caps_only_ever_trim_this_displays_rows():
    s, neon = await live_store()
    await neon._execute("INSERT INTO op.chart_agents (agent_id, npub, label) VALUES ('b2', 'npub1x', 'wall')")
    for i in range(21):
        neon.clock += 1
        await s.keep_capture("b2", PICTURE, f"B{i}")
    await keep(s, neon, "PLTR", 7)
    assert len([r for r in neon.rows("chart_captures") if r["agent_id"] == "b2"]) == 20
    assert len([r for r in neon.rows("chart_captures") if r["agent_id"] == "a1"]) == 6


async def test_captures_live_four_hours_then_are_neither_listed_nor_shown():
    s, neon = await live_store()
    [cid] = await keep(s, neon, "PLTR")
    neon.clock += 4 * 60 * 60 - 1
    assert (await s.latest("a1", capture=cid)).capture == cid
    assert (await s.kept_captures("npub1x"))["a1"][0].symbol == "PLTR"
    neon.clock += 1
    assert await s.kept_captures("npub1x") == {}
    assert await s.latest("a1", capture=cid) is None
    assert neon.rows("chart_captures") == [], "swept, not just hidden"
    assert agents.CAPTURE_TTL_SECONDS == 4 * 60 * 60


async def test_a_capture_opens_only_under_its_own_capture_id():
    s, neon = await live_store()
    first, second = await keep(s, neon, "PLTR", 2)
    # Swap the two ciphertexts: each row now holds the other capture's picture.
    rows = {r["capture_id"]: r["image"] for r in neon.rows("chart_captures")}
    for cid, other in ((first, second), (second, first)):
        neon.db.execute("UPDATE op.chart_captures SET image = ? WHERE capture_id = ?", [rows[other], cid])
    with pytest.raises(InvalidTag):
        await s.latest("a1", capture=first)


async def test_a_capture_sealed_for_one_display_will_not_open_as_another():
    s, neon = sealed_store()
    sealed = CIPHER.encrypt(PICTURE, aad="a1|latest|PLTR|00000000000000aa")
    neon.responses = [{"rows": []}, {"rows": [
        {"capture_id": "00000000000000aa", "symbol": "PLTR", "image": sealed, "taken": time.time()}]}]
    with pytest.raises(InvalidTag):
        await s.latest("b2", "PLTR")


async def test_a_capture_relabelled_as_another_symbol_will_not_open():
    s, neon = sealed_store()
    sealed = CIPHER.encrypt(PICTURE, aad="a1|latest|PLTR|00000000000000aa")
    neon.responses = [{"rows": []}, {"rows": [
        {"capture_id": "00000000000000aa", "symbol": "NVDA", "image": sealed, "taken": time.time()}]}]
    with pytest.raises(InvalidTag):
        await s.latest("a1", "NVDA")


async def test_a_capture_is_found_by_id_by_symbol_or_as_the_newest():
    s, neon = await live_store()
    [p1, p2] = await keep(s, neon, "PLTR", 2, scale="half")
    [n1] = await keep(s, neon, "NVDA")
    assert (await s.latest("a1")).capture == n1
    newest_pltr = await s.latest("a1", "pltr")
    assert (newest_pltr.capture, newest_pltr.symbol, newest_pltr.scale) == (p2, "PLTR", "half")
    assert newest_pltr.data_url == PICTURE
    assert (await s.latest("a1", capture=p1)).capture == p1
    # A capture asked for under the wrong symbol is not found.
    assert await s.latest("a1", "NVDA", p1) is None
    # Nor on another display.
    assert await s.latest("b2", capture=p1) is None


@pytest.mark.parametrize("bad", ["x", "' OR 1=1 --", "0" * 40])
async def test_a_malformed_capture_id_is_refused_before_any_sql(bad):
    s, neon = sealed_store()
    with pytest.raises(ValueError):
        await s.latest("a1", capture=bad)
    assert neon.sql == []


async def test_each_symbol_is_kept_under_its_own_key_upper_cased():
    s, neon = await live_store()
    await s.keep_capture("a1", PICTURE, " pltr ")
    assert neon.rows("chart_captures")[0]["symbol"] == "PLTR"


async def test_a_picture_without_a_symbol_is_kept_as_chart_not_dropped():
    s, neon = await live_store()
    await s.keep_capture("a1", PICTURE)
    assert neon.rows("chart_captures")[0]["symbol"] == agents.UNLABELLED
    assert agents.symbol_name(agents.UNLABELLED) == "Chart"


@pytest.mark.parametrize("bad", ["TOO-LONG-A-SYMBOL", "PL TR", "<script>", "PLTR;--", "ÆBC", 7])
async def test_a_symbol_that_is_not_symbol_shaped_is_refused_before_anything_is_stored(bad):
    s, neon = sealed_store()
    with pytest.raises(ValueError):
        await s.keep_capture("a1", PICTURE, bad)
    assert neon.sql == []


@pytest.mark.parametrize("good", ["/ES", ".SPX", "$SPX.X", "^VIX", "BRK/B", "BRK-B", "a"])
def test_futures_indices_and_share_classes_are_symbols(good):
    assert agents.symbol_key(good) == good.upper()


async def test_a_bad_scale_is_stored_as_none_not_refused():
    s, neon = await live_store()
    await s.keep_capture("a1", PICTURE, "PLTR", "<script>alert(1)</script>")
    assert neon.rows("chart_captures")[0]["scale"] is None


async def test_nothing_kept_reads_as_none():
    s, _ = await live_store()
    assert await s.latest("a1") is None
    assert await s.latest("a1", "PLTR") is None
    assert await s.kept_captures("npub1x") == {}


async def test_kept_lists_only_the_callers_own_displays():
    s, neon = await live_store()
    await neon._execute("INSERT INTO op.chart_agents (agent_id, npub, label) VALUES ('z9', 'npub1other', 'x')")
    await keep(s, neon, "PLTR")
    neon.clock += 1
    await s.keep_capture("z9", PICTURE, "NVDA")
    assert list(await s.kept_captures("npub1x")) == ["a1"]
    assert list(await s.kept_captures("npub1other")) == ["z9"]


async def test_the_migration_drops_the_old_picture_tables_and_is_idempotent():
    neon = SqliteNeon(cipher=CIPHER)
    # A database as the last release left it: one picture per symbol.
    neon.db.execute("CREATE TABLE op.chart_pictures (agent_id TEXT, symbol TEXT, image TEXT, "
                    "PRIMARY KEY (agent_id, symbol))")
    neon.db.execute("INSERT INTO op.chart_pictures VALUES ('a1', 'PLTR', 'sealed')")
    s = AgentStore(neon_vault=neon, runtime=FakeRuntime())
    await s.ensure_schema()
    await s.keep_capture("a1", PICTURE, "PLTR")
    await s.ensure_schema()
    tables = neon.tables()
    assert "chart_captures" in tables and not {"chart_pictures", "chart_latest"} & tables
    assert len(neon.rows("chart_captures")) == 1, "a second run leaves today's captures alone"


@pytest.mark.parametrize(("reply", "label"), [
    ("PLTR at half", ("PLTR", "half")),
    ("brk/b at 30 minutes", ("BRK/B", "30 minutes")),
    ("ERR thinkorswim is not open", ("-", None)),
    ("ERR at x", ("-", None)),
    ("<script> at half", ("-", None)),
    ("PLTR at <b>half</b>", ("PLTR", None)),
    ("", ("-", None)),
    (None, ("-", None)),
])
def test_a_read_reply_labels_a_live_capture_or_leaves_it_unlabelled(reply, label):
    assert agents.read_label(reply) == label


# -- naming a display ----------------------------------------------------------

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
    with pytest.raises(AmbiguousDisplay, match=r"desk \(a1\), desk \(a2\)"):
        await s.resolve("n", "Desk")


def _owned(s, monkeypatch, *pairs, live=()):
    """Give ``s`` the displays (agent_id, label) of npub "n", plus one of a stranger's."""
    mine = [agents.Agent(agent_id=i, npub="n", label=label, secret="",
                         last_seen=time.time() if i in live else 0.0) for i, label in pairs]
    theirs = agents.Agent(agent_id="z9", npub="npub1stranger", label="Mac Mini", secret="",
                          last_seen=time.time())

    async def for_npub(npub): return [a for a in [*mine, theirs] if a.npub == npub]
    monkeypatch.setattr(s, "for_npub", for_npub)
    return {a.agent_id: a for a in mine}


@pytest.mark.parametrize("said", ["mac mini", "mini mac", "mini", "macm", "mack meeny"])
async def test_loose_names_find_the_display(monkeypatch, said):
    s = store()
    owned = _owned(s, monkeypatch, ("a1", "Mac Mini"), ("a2", "office wall"))
    assert await s.resolve("n", said) is owned["a1"]


async def test_an_exact_name_beats_a_looser_hit_on_another_display(monkeypatch):
    s = store()
    owned = _owned(s, monkeypatch, ("a1", "mini"), ("a2", "Mac Mini"))
    assert await s.resolve("n", "Mini") is owned["a1"]


async def test_a_loose_name_that_finds_several_is_refused_with_them(monkeypatch):
    s = store()
    _owned(s, monkeypatch, ("a1", "mac mini"), ("a2", "mac studio"))
    with pytest.raises(AmbiguousDisplay) as caught:
        await s.resolve("n", "mac")
    assert [a.agent_id for a in caught.value.candidates] == ["a1", "a2"]
    assert "mac mini (a1), mac studio (a2)" in str(caught.value)


async def test_of_several_loose_hits_the_one_live_display_is_meant(monkeypatch):
    s = store()
    owned = _owned(s, monkeypatch, ("a1", "mac mini"), ("a2", "mac studio"), live=("a2",))
    assert await s.resolve("n", "mac") is owned["a2"]


async def test_loose_matching_never_reaches_another_owners_display(monkeypatch):
    s = store()
    _owned(s, monkeypatch, ("a1", "office wall"))
    for said in ("mac mini", "mini", "z9"):
        with pytest.raises(NoSuchDisplay) as caught:
            await s.resolve("n", said)
        assert caught.value.names == ["office wall"]
