"""The tools as a caller meets them: proof, refunds, forgetting, snapshots.

Driven through FastMCP's own in-memory client, so what is asserted is what
actually reaches an MCP client - not what a function returned before the
wheel's decorators and FastMCP's serializer had their say.
"""

import base64
import time

import pytest
from fastmcp import Client
from starlette.testclient import TestClient

from chartremotely_mcp import server, snapshot
from chartremotely_mcp.agents import Agent
from chartremotely_mcp.store import AgentStore

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

    async def latest_times(self, npub):
        return {k: v[1] for k, v in self.kept.items()}

    async def latest(self, agent_id):
        return self.kept.get(agent_id)

    async def authenticate(self, agent_id, secret):
        return self.displays[0] if (agent_id, secret) == ("a1", "s1") else None

    async def keep_latest(self, agent_id, data_url):
        if getattr(self, "no_cipher", False):
            raise RuntimeError("no cipher")
        self.kept = {**self.kept, agent_id: (data_url, 1700000000.0)}


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
    [image] = result.content
    assert image.type == "image" and image.mime_type == "image/jpeg"
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
    r = push(fake, monkeypatch, agent_id="a1", secret="s1", image=GOOD_IMAGE)
    assert r.status_code == 200 and r.json() == {"kept": True}
    assert fake.kept["a1"][0] == GOOD_IMAGE


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


async def test_status_says_when_a_display_last_kept_a_picture(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    fake.kept = {"a1": (GOOD_IMAGE, 1700000000.0)}
    result = await call("agent_status", dpop_token="good")
    assert result.structured_content["displays"][0]["latest_at"] == "2023-11-14T22:13:20+00:00"


async def test_the_kept_picture_is_shown_and_charged_once(monkeypatch, billing):
    fake = use(monkeypatch, FakeStore())
    fake.kept = {"a1": (GOOD_IMAGE, 1700000000.0)}
    result = await call("latest_snapshot", dpop_token="good")
    [image] = result.content
    assert base64.b64decode(image.data) == JPEG
    assert result.structured_content["taken_at"] == "2023-11-14T22:13:20+00:00"
    assert fake.sent == [], "showing the kept picture never wakes the display"
    assert (billing["debit"], billing["rollback"]) == (1, 0)


async def test_no_kept_picture_costs_nothing(monkeypatch, billing):
    use(monkeypatch, FakeStore())
    result = await call("latest_snapshot", dpop_token="good")
    assert billing["rollback"] == 1
    assert "no picture from the last hour" in str(result.structured_content)
