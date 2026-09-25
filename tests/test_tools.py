"""The tools as a caller meets them: proof, refunds, forgetting, snapshots.

Driven through FastMCP's own in-memory client, so what is asserted is what
actually reaches an MCP client - not what a function returned before the
wheel's decorators and FastMCP's serializer had their say.
"""

import asyncio
import base64
import threading
import time
from contextlib import contextmanager

import pytest
from fastmcp import Client
from starlette.testclient import TestClient

from chartremotely_mcp import server, snapshot
from chartremotely_mcp.agents import Agent
from chartremotely_mcp.store import AgentStore, KeptPicture

NPUB = "npub1caller"
JPEG = b"\xff\xd8\xff\xe0" + b"chart" * 50


class FakeStore:
    """A store whose displays and relay replies a test chooses."""

    def __init__(self, reply="AAPL at daily", displays=None):
        self.reply = reply
        self.displays = displays if displays is not None else [
            Agent(agent_id="a1", npub=NPUB, label="desk", secret="", last_seen=time.time())]
        self.sent: list[str] = []
        self.forgotten: list[str] = []
        self.kept: dict = {}

    async def resolve(self, npub, display):
        return await AgentStore.resolve(self, npub, display)

    async def for_npub(self, npub):
        return [a for a in self.displays if a.npub == npub]

    async def send(self, agent_id, command, timeout=0):
        self.sent.append(command)
        if isinstance(self.reply, BaseException):
            raise self.reply
        return self.reply

    async def forget(self, npub, display):
        agent = (await self.for_npub(npub))[0]
        self.forgotten.append(agent.agent_id)
        return agent

    async def claim(self, code, npub, label):
        return Agent(agent_id="new", npub=npub, label=label, secret="s")

    async def kept_symbols(self, npub):
        out = {}
        for (agent_id, symbol), (_, taken) in sorted(
                self.kept.items(), key=lambda kv: -kv[1][1]):
            out.setdefault(agent_id, []).append((symbol, taken))
        return out

    async def latest(self, agent_id, symbol=None):
        mine = [(k[1], v) for k, v in self.kept.items() if k[0] == agent_id]
        if symbol:
            mine = [m for m in mine if m[0] == symbol]
        if not mine:
            return None
        key, (data_url, taken, *scale) = max(mine, key=lambda m: m[1][1])
        return KeptPicture(data_url, taken, key, *scale)

    async def authenticate(self, agent_id, secret):
        return self.displays[0] if (agent_id, secret) == ("a1", "s1") else None

    async def keep_latest(self, agent_id, data_url, symbol="", scale=None):
        if getattr(self, "no_cipher", False):
            raise RuntimeError("no cipher")
        self.kept = {**self.kept, (agent_id, symbol): (data_url, 1700000000.0, scale)}


@pytest.fixture
def billing(monkeypatch):
    """Stand in for the wheel's debit, rollback and proof checks."""
    calls = {"debit": 0, "rollback": 0, "proof": []}

    async def debit_or_deny(tool_id, npub, **kw):
        calls["debit"] += 1
        return 1

    async def rollback_debit(tool_id, npub, **kw):
        calls["rollback"] += 1

    async def require_caller_proof(npub, dpop_token, capability):
        calls["proof"].append(capability)
        if dpop_token != "good":
            return {"success": False, "error_code": "proof_required", "error": "prove it"}
        return None

    monkeypatch.setattr(server.runtime, "debit_or_deny", debit_or_deny)
    monkeypatch.setattr(server.runtime, "rollback_debit", rollback_debit)
    monkeypatch.setattr(server.runtime, "require_caller_proof", require_caller_proof)
    monkeypatch.setattr(server.runtime, "inject_low_balance_warning",
                        lambda result, npub: _identity(result))
    for name in ("fire_and_forget_demand_increment", "fire_and_forget_supply_increment",
                 "fire_and_forget_notarize_if_stale"):
        monkeypatch.setattr(server.runtime, name, lambda *a, **k: None)
    return calls


async def _identity(result):
    return result


def use(monkeypatch, fake):
    async def store():
        return fake
    monkeypatch.setattr(server, "store", store)
    return fake


async def call(tool, **args):
    async with Client(server.mcp) as client:
        return await client.call_tool(f"chart_{tool}", {"npub": NPUB, **args},
                                      raise_on_error=False)


# -- proof ---------------------------------------------------------------

@pytest.mark.parametrize("tool,args", [
    ("agent_status", {}),
    ("pair_agent", {"code": "ABC234"}),
    ("forget_display", {"display": "desk"}),
])
async def test_free_tools_refuse_a_caller_without_proof(monkeypatch, billing, tool, args):
    fake = use(monkeypatch, FakeStore())
    result = await call(tool, dpop_token="forged", **args)
    assert result.structured_content["error_code"] == "proof_required"
    assert billing["proof"] == [tool]
    assert fake.forgotten == []


async def test_a_proven_caller_sees_their_displays(monkeypatch, billing):
    use(monkeypatch, FakeStore())
    result = await call("agent_status", dpop_token="good")
    assert result.structured_content["displays"][0]["label"] == "desk"


async def test_forget_removes_the_display(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    result = await call("forget_display", display="desk", dpop_token="good")
    assert result.structured_content == {"ok": True, "forgot": "desk", "agent_id": "a1"}
    assert fake.forgotten == ["a1"]


# -- refunds -------------------------------------------------------------

@pytest.mark.parametrize("tool,args", [
    ("show_chart", {"security": "AAPL"}),
    ("read_chart", {}),
    ("snapshot_display", {}),
])
async def test_a_display_that_never_answers_costs_nothing(monkeypatch, billing, tool, args):
    use(monkeypatch, FakeStore(reply=TimeoutError()))
    result = await call(tool, dpop_token="good", **args)
    assert billing == {**billing, "debit": 1, "rollback": 1}
    assert server.NO_ANSWER in str(result.structured_content or result.content)


async def test_a_mistyped_display_name_costs_nothing(monkeypatch, billing):
    use(monkeypatch, FakeStore())
    result = await call("read_chart", display="kitchen", dpop_token="good")
    assert billing["rollback"] == 1
    assert "kitchen" in str(result.structured_content)


async def test_an_answered_command_is_charged_once(monkeypatch, billing):
    use(monkeypatch, FakeStore())
    await call("read_chart", dpop_token="good")
    assert (billing["debit"], billing["rollback"]) == (1, 0)


# -- snapshots -----------------------------------------------------------

async def test_a_snapshot_reaches_the_client_as_an_image(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore(reply=snapshot.PREFIX + base64.b64encode(JPEG).decode()))
    result = await call("snapshot_display", dpop_token="good")
    assert fake.sent == ["snapshot"]
    [text, image] = result.content
    assert image.type == "image" and image.mime_type == "image/jpeg"
    assert text.type == "text" and text.text.startswith("desk · captured ")
    assert text.text.endswith(" UTC") and "None" not in text.text
    assert base64.b64decode(image.data) == JPEG
    assert result.structured_content["display"] == "desk"
    assert result.structured_content["taken_at"].endswith("+00:00")
    assert billing["rollback"] == 0


async def test_an_agent_that_cannot_capture_is_not_charged(monkeypatch, billing):
    use(monkeypatch, FakeStore(reply="ERR no thinkorswim window on screen"))
    result = await call("snapshot_display", dpop_token="good")
    assert billing["rollback"] == 1
    assert "no thinkorswim window" in str(result.structured_content)


# -- the untrusted reply --------------------------------------------------

def test_a_well_formed_reply_is_accepted():
    assert snapshot.parse(snapshot.PREFIX + base64.b64encode(JPEG).decode()) == JPEG


@pytest.mark.parametrize("reply,why", [
    ("ERR no window", "no window"),
    ("data:image/png;base64," + base64.b64encode(JPEG).decode(), "not a snapshot"),
    (snapshot.PREFIX + "not*base64", "damaged"),
    (snapshot.PREFIX + base64.b64encode(b"GIF89a").decode(), "not a JPEG"),
    (snapshot.PREFIX + "A" * snapshot.MAX_REPLY_CHARS, "too large"),
])
def test_anything_else_is_refused(reply, why):
    with pytest.raises(ValueError, match=why):
        snapshot.parse(reply)



# -- the kept picture ----------------------------------------------------------

GOOD_IMAGE = snapshot.PREFIX + base64.b64encode(JPEG).decode()


def push(fake, monkeypatch, **body):
    use(monkeypatch, fake)
    with TestClient(server.mcp.http_app()) as client:
        return client.post("/agent/snapshot", json=body)


def test_an_agent_can_keep_its_latest_picture(monkeypatch):
    fake = FakeStore()
    r = push(fake, monkeypatch, agent_id="a1", secret="s1", image=GOOD_IMAGE, symbol="pltr")
    assert r.status_code == 200 and r.json() == {"kept": True}
    assert fake.kept[("a1", "PLTR")][0] == GOOD_IMAGE


def test_a_picture_without_a_symbol_is_kept_as_chart(monkeypatch):
    fake = FakeStore()
    r = push(fake, monkeypatch, agent_id="a1", secret="s1", image=GOOD_IMAGE)
    assert r.status_code == 200 and list(fake.kept) == [("a1", "-")]


@pytest.mark.parametrize("bad", ["<img src=x>", "A" * 16, "PL TR", 42, ["PLTR"]])
def test_a_symbol_that_is_not_symbol_shaped_is_refused(monkeypatch, bad):
    fake = FakeStore()
    r = push(fake, monkeypatch, agent_id="a1", secret="s1", image=GOOD_IMAGE, symbol=bad)
    assert r.status_code == 400 and fake.kept == {}


def test_a_stranger_cannot_keep_a_picture(monkeypatch):
    fake = FakeStore()
    r = push(fake, monkeypatch, agent_id="a1", secret="guess", image=GOOD_IMAGE)
    assert r.status_code == 403 and fake.kept == {}


def test_anything_but_a_jpeg_is_refused(monkeypatch):
    fake = FakeStore()
    r = push(fake, monkeypatch, agent_id="a1", secret="s1", image="data:image/png;base64,AAAA")
    assert r.status_code == 400 and fake.kept == {}


def test_no_cipher_means_nothing_is_kept(monkeypatch):
    fake = FakeStore()
    fake.no_cipher = True
    r = push(fake, monkeypatch, agent_id="a1", secret="s1", image=GOOD_IMAGE)
    assert r.status_code == 503 and fake.kept == {}


def _two_symbols(fake):
    other = snapshot.PREFIX + base64.b64encode(JPEG + b"nvda").decode()
    fake.kept = {("a1", "PLTR"): (GOOD_IMAGE, 1700000000.0),
                 ("a1", "NVDA"): (other, 1700000060.0)}


async def test_status_lists_each_kept_symbol_newest_first(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    _two_symbols(fake)
    fake.kept[("a1", "-")] = (GOOD_IMAGE, 1699999000.0)
    result = await call("agent_status", dpop_token="good")
    assert result.structured_content["displays"][0]["kept"] == [
        {"symbol": "NVDA", "name": "NVDA", "taken_at": "2023-11-14T22:14:20+00:00"},
        {"symbol": "PLTR", "name": "PLTR", "taken_at": "2023-11-14T22:13:20+00:00"},
        {"symbol": "-", "name": "Chart", "taken_at": "2023-11-14T21:56:40+00:00"},
    ]


async def test_status_with_nothing_kept_lists_nothing(monkeypatch, billing):
    use(monkeypatch, FakeStore())
    result = await call("agent_status", dpop_token="good")
    assert result.structured_content["displays"][0]["kept"] == []


async def test_the_kept_picture_is_shown_and_charged_once(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    fake.kept = {("a1", "PLTR"): (GOOD_IMAGE, 1700000000.0)}
    result = await call("latest_snapshot", dpop_token="good")
    [_, image] = result.content
    assert base64.b64decode(image.data) == JPEG
    assert result.structured_content["taken_at"] == "2023-11-14T22:13:20+00:00"
    assert result.structured_content["symbol"] == "PLTR"
    assert fake.sent == [], "showing the kept picture never wakes the display"
    assert (billing["debit"], billing["rollback"]) == (1, 0)


async def test_no_symbol_shows_the_newest_and_a_symbol_shows_its_own(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    _two_symbols(fake)
    newest = await call("latest_snapshot", dpop_token="good")
    assert newest.structured_content["symbol"] == "NVDA"
    older = await call("latest_snapshot", symbol="pltr", dpop_token="good")
    assert older.structured_content["symbol"] == "PLTR"
    assert base64.b64decode(older.content[1].data) == JPEG
    assert (billing["debit"], billing["rollback"]) == (2, 0)


async def test_a_kept_picture_leads_with_a_line_of_its_facts(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    fake.kept = {("a1", "PLTR"): (GOOD_IMAGE, 1700000000.0, "half")}
    result = await call("latest_snapshot", dpop_token="good")
    text, image = result.content
    assert (text.type, image.type) == ("text", "image"), "text first, so it survives truncation"
    assert text.text == "desk · PLTR · half · captured 2023-11-14 22:13 UTC"
    assert result.structured_content["scale"] == "half"


async def test_the_line_names_nothing_that_is_unknown(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    fake.kept = {("a1", "-"): (GOOD_IMAGE, 1700000000.0, None)}
    result = await call("latest_snapshot", dpop_token="good")
    assert result.content[0].text == "desk · captured 2023-11-14 22:13 UTC"
    assert "None" not in result.content[0].text and "Chart" not in result.content[0].text
    assert "scale" not in result.structured_content


def test_a_pushed_scale_is_kept_and_shown_back(monkeypatch):
    fake = FakeStore()
    r = push(fake, monkeypatch, agent_id="a1", secret="s1", image=GOOD_IMAGE,
             symbol="PLTR", scale=" 30  minutes ")
    assert r.status_code == 200
    assert fake.kept[("a1", "PLTR")][2] == "30 minutes"


@pytest.mark.parametrize("bad", ["x" * 25, "<b>half</b>", "half;", "half\x07", "", 30, ["half"]])
def test_a_bad_scale_is_dropped_but_the_picture_kept(monkeypatch, bad):
    fake = FakeStore()
    r = push(fake, monkeypatch, agent_id="a1", secret="s1", image=GOOD_IMAGE,
             symbol="PLTR", scale=bad)
    assert r.status_code == 200 and fake.kept[("a1", "PLTR")][2] is None


async def test_a_symbol_not_kept_costs_nothing(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    _two_symbols(fake)
    result = await call("latest_snapshot", symbol="TSLA", dpop_token="good")
    assert billing["rollback"] == 1
    assert "no picture of TSLA from the last hour" in str(result.structured_content)


async def test_a_malformed_symbol_costs_nothing(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    _two_symbols(fake)
    await call("latest_snapshot", symbol="<script>", dpop_token="good")
    assert billing["rollback"] == 1


async def test_no_kept_picture_costs_nothing(monkeypatch, billing):
    use(monkeypatch, FakeStore())
    result = await call("latest_snapshot", dpop_token="good")
    assert billing["rollback"] == 1
    assert "no picture from the last hour" in str(result.structured_content)


# -- one display hands a command to another ------------------------------------

OTHER = "npub1stranger"


class ForwardingStore(FakeStore):
    """Two owners' displays; records which display each command was sent to.

    ``hold`` keeps every relay waiting until the test sets it, so a test can
    see what the caller was told before the chart changed.
    """

    def __init__(self, reply="Showing PLTR at daily. Good luck.", displays=None):
        now = time.time()
        super().__init__(reply, displays if displays is not None else [
            Agent(agent_id="a1", npub=NPUB, label="desk", secret="", last_seen=now),
            Agent(agent_id="a2", npub=NPUB, label="Mac Mini", secret="", last_seen=now),
            Agent(agent_id="a3", npub=NPUB, label="attic", secret="", last_seen=0),
            Agent(agent_id="x1", npub=OTHER, label="office", secret="", last_seen=now),
        ])
        self.to: list[tuple[str, str]] = []
        self.hold = threading.Event()
        self.hold.set()
        self.settled = threading.Event()

    async def send(self, agent_id, command, timeout=0):
        self.to.append((agent_id, command))
        while not self.hold.is_set():
            await asyncio.sleep(0.01)
        return await super().send(agent_id, command, timeout)


@pytest.fixture
def fares(monkeypatch):
    """The wheel's pricing, constraint and billing stages, counted.

    ``balance`` is what the owner holds; a fare of 3 beyond it is refused the
    way the wheel refuses it.
    """
    calls = {"priced": [], "debited": [], "refunded": [], "balance": 100}

    async def resolve_pricing(tool_id, name, category, tool_kwargs):
        calls["priced"].append((tool_id, name, category, dict(tool_kwargs)))
        return 3, None

    async def evaluate_constraints(tool_id, name, npub, cost, dpop_token):
        return cost, [], None

    async def apply_billing(npub, name, cost, coupons):
        if calls["balance"] < cost:
            return {"success": False, "error_code": "insufficient_balance",
                    "error": f"Insufficient balance: {calls['balance']} sats available, "
                             f"{cost} required for {name}."}
        calls["balance"] -= cost
        calls["debited"].append((npub, name, cost))
        return cost

    async def rollback_debit(tool_id, npub, **kw):
        calls["refunded"].append((tool_id, npub))

    monkeypatch.setattr(server.runtime, "_resolve_pricing", resolve_pricing)
    monkeypatch.setattr(server.runtime, "_evaluate_constraints", evaluate_constraints)
    monkeypatch.setattr(server.runtime, "_apply_billing", apply_billing)
    monkeypatch.setattr(server.runtime, "rollback_debit", rollback_debit)
    for name in ("fire_and_forget_demand_increment", "fire_and_forget_supply_increment",
                 "fire_and_forget_notarize_if_stale"):
        monkeypatch.setattr(server.runtime, name, lambda *a, **k: None)
    return calls


@contextmanager
def forwarding(fake, monkeypatch):
    """A client for /agent/forward whose background relays run until it closes."""
    use(monkeypatch, fake)
    with TestClient(server.mcp.http_app()) as client:
        def post(**body):
            return client.post("/agent/forward", json={"agent_id": "a1", "secret": "s1", **body})
        yield post


def forward(fake, monkeypatch, **body):
    with forwarding(fake, monkeypatch) as post:
        response = post(**body)
        settle()
        return response


def settle():
    """Wait for every relay the operator started in the background."""
    deadline = time.time() + 5
    while server._IN_FLIGHT and time.time() < deadline:
        time.sleep(0.01)
    assert not server._IN_FLIGHT, "a background relay never finished"


def test_a_stranger_cannot_forward(monkeypatch, fares):
    fake = ForwardingStore()
    r = forward(fake, monkeypatch, secret="guess", display="Mac Mini", cmd="set PLTR | daily")
    assert r.status_code == 403 and fake.to == [] and fares["debited"] == []


@pytest.mark.parametrize("said", ["Mac Mini", "mac-mini", "macmini", "MAC MINI", "mac_mini", "a2"])
def test_the_named_display_gets_the_command_verbatim(monkeypatch, fares, said):
    fake = ForwardingStore()
    r = forward(fake, monkeypatch, display=said, cmd="set PLTR | daily")
    assert r.status_code == 202
    assert r.json() == {"accepted": True, "display": "Mac Mini", "symbol": "PLTR", "scale": "daily"}
    assert fake.to == [("a2", "set PLTR | daily")]


def test_a_forward_is_priced_once_as_show_chart_for_the_owner(monkeypatch, fares):
    forward(ForwardingStore(), monkeypatch, display="Mac Mini", cmd="set PLTR | half")
    [(tool_id, name, category, kwargs)] = fares["priced"]
    assert (tool_id, name, category) == (server.SHOW_CHART_UUID, "chart_show_chart", "write")
    assert kwargs == {"security": "PLTR", "scale": "half", "display": "Mac Mini",
                      "npub": NPUB, "dpop_token": ""}
    assert fares["debited"] == [(NPUB, "chart_show_chart", 3)] and fares["refunded"] == []


def test_a_bare_company_is_priced_as_show_chart_and_relayed_as_said(monkeypatch, fares):
    fake = ForwardingStore()
    r = forward(fake, monkeypatch, display="Mac Mini", cmd="john deere")
    assert r.status_code == 202 and r.json() == {"accepted": True, "display": "Mac Mini"}
    assert fares["priced"][0][3]["security"] == "john deere"
    assert fake.to == [("a2", "john deere")] and len(fares["debited"]) == 1


def test_the_callers_own_agent_id_is_charged_and_relayed_to_itself(monkeypatch, fares):
    fake = ForwardingStore()
    r = forward(fake, monkeypatch, display="a1", cmd="set PLTR | daily")
    assert r.status_code == 202 and r.json()["display"] == "desk"
    assert fake.to == [("a1", "set PLTR | daily")] and len(fares["debited"]) == 1


def test_accepted_goes_back_before_the_chart_changes(monkeypatch, fares):
    fake = ForwardingStore()
    fake.hold.clear()
    with forwarding(fake, monkeypatch) as post:
        r = post(display="Mac Mini", cmd="set PLTR | daily")
        assert r.status_code == 202 and server._IN_FLIGHT, "the relay is still running"
        fake.hold.set()
        settle()
    assert fake.to == [("a2", "set PLTR | daily")] and fares["refunded"] == []


def test_insufficient_balance_is_refused_at_once_and_nothing_is_sent(monkeypatch, fares):
    fares["balance"] = 2
    fake = ForwardingStore()
    r = forward(fake, monkeypatch, display="Mac Mini", cmd="set PLTR | daily")
    assert r.status_code == 402 and r.json()["error_code"] == "insufficient_balance"
    assert r.json()["error"].startswith("Insufficient balance")
    assert fake.to == [] and fares["debited"] == []


def test_a_display_that_never_answers_is_refunded(monkeypatch, fares, caplog):
    fake = ForwardingStore(reply=TimeoutError())
    r = forward(fake, monkeypatch, display="Mac Mini", cmd="set PLTR | daily")
    assert r.status_code == 202
    assert fares["refunded"] == [(server.SHOW_CHART_UUID, NPUB)]
    assert "Mac Mini (a2) failed, fare refunded" in caplog.text and "s1" not in caplog.text


def test_a_display_that_answers_err_keeps_the_fare_and_says_so_in_the_log(monkeypatch, fares, caplog):
    fake = ForwardingStore(reply="ERR no match for 'zzz'")
    forward(fake, monkeypatch, display="Mac Mini", cmd="zzz")
    assert len(fares["debited"]) == 1 and fares["refunded"] == []
    assert "Mac Mini (a2) answered: ERR no match" in caplog.text


@pytest.mark.parametrize("cmd", ["read", "snapshot", "resolve palantir", "scale half", "set  | half"])
def test_only_a_chart_change_is_forwarded(monkeypatch, fares, cmd):
    fake = ForwardingStore()
    r = forward(fake, monkeypatch, display="Mac Mini", cmd=cmd)
    assert r.status_code == 400 and fake.to == [] and fares["debited"] == []


def test_another_owners_display_is_not_reachable_even_by_id(monkeypatch, fares):
    fake = ForwardingStore()
    for said in ("office", "x1"):
        r = forward(fake, monkeypatch, display=said, cmd="set PLTR | daily")
        assert r.status_code == 404
        assert r.json()["displays"] == ["desk", "Mac Mini", "attic"]
    assert fake.to == [] and fares["debited"] == []


def test_an_unknown_name_lists_the_owners_displays(monkeypatch, fares):
    r = forward(ForwardingStore(), monkeypatch, display="kitchen", cmd="set PLTR | daily")
    assert r.status_code == 404
    assert r.json() == {"error": "no display named 'kitchen'",
                        "displays": ["desk", "Mac Mini", "attic"]}
    assert fares["debited"] == []


def test_an_offline_display_is_reported_not_queued_or_charged(monkeypatch, fares):
    fake = ForwardingStore()
    r = forward(fake, monkeypatch, display="Attic", cmd="set PLTR | daily")
    assert r.status_code == 503 and "attic is offline" in r.json()["error"]
    assert fake.to == [] and fares["debited"] == []


def test_twins_are_refused_with_the_candidates(monkeypatch, fares):
    fake = ForwardingStore(displays=[
        Agent(agent_id="a1", npub=NPUB, label="desk", secret="", last_seen=time.time()),
        Agent(agent_id="t1", npub=NPUB, label="wall", secret=""),
        Agent(agent_id="t2", npub=NPUB, label="Wall", secret="")])
    r = forward(fake, monkeypatch, display="wall", cmd="set PLTR | daily")
    assert r.status_code == 409
    assert [c["agent_id"] for c in r.json()["candidates"]] == ["t1", "t2"]
    assert r.json()["error"] == ("Two displays are named wall; "
                                 "rename one at chartremotely.tollbooth-dpyc.com.")


@pytest.mark.parametrize(("labels", "spoken"), [
    (["Mac mini", "Mac studio"], "Which one: Mac mini or Mac studio?"),
    (["Mac mini", "Mac studio", "Mac pro"], "Which one: Mac mini, Mac studio or Mac pro?"),
])
def test_a_loose_name_that_finds_several_is_spoken_as_a_question_without_ids(
        monkeypatch, fares, labels, spoken):
    fake = ForwardingStore(displays=[
        Agent(agent_id="a1", npub=NPUB, label="desk", secret="", last_seen=time.time()),
        *[Agent(agent_id=f"m{i}", npub=NPUB, label=label, secret="")
          for i, label in enumerate(labels)]])
    r = forward(fake, monkeypatch, display="mac", cmd="set PLTR | daily")
    assert r.status_code == 409 and r.json()["error"] == spoken
    assert not any(f"m{i}" in r.json()["error"] for i in range(len(labels)))
    assert fake.to == []


@pytest.mark.parametrize("body", [
    {"display": "Mac Mini", "cmd": "x" * 201},
    {"display": "Mac Mini", "cmd": "set PLTR\n| daily"},
    {"display": "Mac Mini", "cmd": ""},
    {"display": "Mac Mini", "cmd": ["set PLTR | daily"]},
    {"display": "m" * 65, "cmd": "set PLTR | daily"},
    {"display": "", "cmd": "set PLTR | daily"},
    {"cmd": "set PLTR | daily"},
])
def test_a_malformed_forward_is_refused_before_anything_is_sent(monkeypatch, fares, body):
    fake = ForwardingStore()
    r = forward(fake, monkeypatch, **body)
    assert r.status_code == 400 and fake.to == [] and fares["debited"] == []
