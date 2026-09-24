"""ChartRemotely — Operator MCP for remote control of desktop charting apps.

Standard DPYC tools (check_balance, purchase_credits, Secure Courier,
Oracle, pricing, constraints) come from ``register_standard_tools`` in the
tollbooth-dpyc wheel. Only domain tools are defined here.

This operator drives nothing itself. It pairs agents running on patrons'
own machines and relays a narrow vocabulary to them, because desktop
charting applications have no automation surface to call.

Run locally:
    python -m chartremotely_mcp.server
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Annotated, Any

from fastmcp import FastMCP
from fastmcp.tools import ToolResult
from fastmcp.utilities.types import Image
from pydantic import Field
from starlette.requests import Request
from starlette.responses import JSONResponse
from tollbooth.credential_templates import CredentialTemplate, FieldSpec
from tollbooth.credential_validators import validate_btcpay_creds
from tollbooth.runtime import OperatorRuntime, register_standard_tools
from tollbooth.tool_identity import STANDARD_IDENTITIES, ToolIdentity

from chartremotely_mcp import __version__, agents, snapshot
from chartremotely_mcp.config import get_settings
from chartremotely_mcp.store import AgentStore

logger = logging.getLogger(__name__)

SHORTCUT_URL = "https://chartremotely.tollbooth-dpyc.com/ChartRemotely.shortcut"

mcp = FastMCP(
    "chartremotely",
    instructions=(
        "ChartRemotely — put a security on a desktop chart anywhere in the "
        "world, by voice or by tool call. Monetized via Tollbooth DPYC "
        "Bitcoin Lightning micropayments.\n\n"
        "## What this is for\n"
        "Desktop charting applications have no API. This operator relays "
        "commands to a small agent running on your own Mac, which drives the "
        "chart through the accessibility layer. The agent dials out, so "
        "nothing on your network is exposed.\n\n"
        "## Getting started\n"
        "1. Install the agent: see github.com/lonniev/ChartRemotely-agent\n"
        "2. Run `chartremotely pair` on that machine — it prints a code\n"
        "3. Call chart_pair_agent(code, label) here to adopt it\n"
        "4. Call chart_get_shortcut for the Apple Shortcut (free)\n\n"
        "## Managing displays\n"
        "chart_agent_status lists your displays and whether each is live; "
        "chart_forget_display removes one you no longer use. "
        "chart_snapshot_display returns a picture of what a display shows; "
        "chart_latest_snapshot shows one it kept after its chart changed — "
        "the newest, or a given symbol's. A display keeps the newest picture "
        "of each of its last 12 symbols, encrypted, each for an hour; "
        "chart_agent_status lists them.\n"
        "The web app at https://chartremotely.tollbooth-dpyc.com does all of "
        "this from a browser.\n\n"
        "## Pricing\n"
        "Pairing, status, forgetting and the Shortcut are free — charging "
        "for setup taxes the wrong thing. chart_show_chart, chart_read_chart, "
        "chart_snapshot_display and chart_latest_snapshot are metered, and a display that does not "
        "answer costs nothing. Use `chart_check_price` to preview and "
        "`chart_check_balance` to see your balance.\n\n"
        "Every tool that takes an npub needs a proof: call "
        "chart_request_npub_proof, then chart_receive_npub_proof, and pass "
        "the dpop_token it returns."
    ),
)

# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

# Frozen UUIDs — minted once at tool birth and never changed. Renaming a
# capability later leaves these intact so the pricing rows stay keyed.
SHOW_CHART_UUID   = "d5a28bfc-c75d-4d24-86ff-580587b653ab"
READ_CHART_UUID   = "26fe821a-9e92-4cd1-be2c-c20d1d6aaff8"
PAIR_AGENT_UUID   = "3a71987b-0e46-4344-9ef6-ab17d987b7ba"
AGENT_STATUS_UUID = "52aa883a-e561-4bce-aee8-171237fc23b3"
GET_SHORTCUT_UUID = "62681384-7298-4ece-869d-902834fc746f"
FORGET_DISPLAY_UUID = "737cdc6a-8ca4-4540-9c4d-512602657e09"
SNAPSHOT_UUID     = "5c2fd96f-4096-4529-adbe-683371e3b543"
LATEST_SNAPSHOT_UUID = "23b296eb-5c4c-44d0-9554-f9324619da35"

_DOMAIN_TOOLS = [
    ToolIdentity(
        tool_id=SHOW_CHART_UUID,
        capability="show_chart",
        category="write",
        intent="Put a security on a paired display",
    ),
    ToolIdentity(
        tool_id=READ_CHART_UUID,
        capability="read_chart",
        category="read",
        intent="Report what a paired display is showing",
    ),
    ToolIdentity(
        tool_id=PAIR_AGENT_UUID,
        capability="pair_agent",
        category="read",
        intent="Bind a waiting agent to this npub",
    ),
    ToolIdentity(
        tool_id=AGENT_STATUS_UUID,
        capability="agent_status",
        category="read",
        intent="List paired displays and whether they are connected",
    ),
    ToolIdentity(
        tool_id=FORGET_DISPLAY_UUID,
        capability="forget_display",
        category="write",
        intent="Remove a paired display and its secret",
    ),
    ToolIdentity(
        tool_id=SNAPSHOT_UUID,
        capability="snapshot_display",
        category="read",
        intent="Return a picture of what a paired display shows",
    ),
    ToolIdentity(
        tool_id=LATEST_SNAPSHOT_UUID,
        capability="latest_snapshot",
        category="read",
        intent="Show the picture a display kept after its last chart change",
    ),
    ToolIdentity(
        tool_id=GET_SHORTCUT_UUID,
        capability="get_shortcut",
        category="read",
        intent="Return the Apple Shortcut for voice control",
    ),
]

TOOL_REGISTRY: dict[str, ToolIdentity] = {ti.tool_id: ti for ti in _DOMAIN_TOOLS}

runtime = OperatorRuntime(
    tool_registry={**STANDARD_IDENTITIES, **TOOL_REGISTRY},
    operator_credential_template=CredentialTemplate(
        service="chartremotely-operator",
        version=1,
        description="Operator credentials for BTCPay Lightning payments",
        fields={
            "btcpay_host": FieldSpec(
                required=True, sensitive=True,
                description="The URL of your BTCPay Server instance (e.g. https://btcpay.example.com).",
            ),
            "btcpay_api_key": FieldSpec(
                required=True, sensitive=True,
                description="Your BTCPay Server API key. Generate one under Account > Manage Account > API Keys.",
            ),
            "btcpay_store_id": FieldSpec(
                required=True, sensitive=True,
                description="Your BTCPay Store ID. Find it under Stores > Settings > General.",
            ),
        },
    ),
    patron_credential_template=CredentialTemplate(
        service="chartremotely",
        version=1,
        description="Per-patron secrets for ChartRemotely",
        fields={
            "agent_token": FieldSpec(
                required=False, sensitive=True,
                description=(
                    "The token your local agent listens with, from "
                    "`chartremotely token`. Supplying it lets the Shortcut "
                    "reach your display directly."
                ),
            ),
        },
    ),
    patron_credential_greeting=(
        "Hi — I'm ChartRemotely. You (or your AI agent) requested a "
        "credential channel to store a token for your display."
    ),
    operator_credential_greeting=(
        "Hi — I'm ChartRemotely, an MCP service for driving desktop charts "
        "remotely. You (or your AI agent) requested a credential channel."
    ),
    service_name="ChartRemotely",
    credential_validator=validate_btcpay_creds,
)

tool = register_standard_tools(
    mcp,
    "chart",
    runtime,
    service_name="chartremotely",
    service_version=__version__,
)

# Durable, on the Neon schema the Authority wired during onboarding. It has
# to be: instances recycle, and a tool call and an agent's open poll can
# land on different ones - so the database is both registry and message bus.
_STORE: AgentStore | None = None


async def store() -> AgentStore:
    global _STORE
    if _STORE is None:
        # vault() is a coroutine that bootstraps from the Authority on first
        # use - not a property. Passing the bound method yields an object
        # with no _execute, which fails at request time rather than import.
        created = AgentStore(neon_vault=await runtime.vault(), runtime=runtime)
        await created.ensure_schema()
        _STORE = created
    return _STORE

NPUB_FIELD = Annotated[
    str,
    Field(description="Required. Your Nostr public key (npub1...) for credit billing."),
]


# ---------------------------------------------------------------------------
# Free tools — the on-ramp
# ---------------------------------------------------------------------------


@tool
async def pair_agent(
    code: str,
    label: str = "display",
    npub: NPUB_FIELD = "",
    dpop_token: str = "",
) -> dict[str, Any]:
    """Adopt an agent that is waiting to be paired.

    Run `chartremotely pair` on the machine driving the display; it prints a
    short code. You prove the machine is yours — you never send a credential
    to it.

    Args:
        code: The pairing code the agent printed.
        label: What to call this display, e.g. "east wall". Used to address it later.
    """
    if err := await runtime.require_caller_proof(npub, dpop_token, "pair_agent"):
        return err
    try:
        agent = await (await store()).claim(code, npub, label)
    except KeyError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "display": agent.label, "agent_id": agent.agent_id}


@tool
async def agent_status(npub: NPUB_FIELD = "", dpop_token: str = "") -> dict[str, Any]:
    """List the displays paired to you, whether each is connected, and the
    pictures each has kept: one per symbol, newest first. Pass a kept entry's
    ``symbol`` to chart_latest_snapshot to see it."""
    if err := await runtime.require_caller_proof(npub, dpop_token, "agent_status"):
        return err
    db = await store()
    owned = await db.for_npub(npub)
    kept = await db.kept_symbols(npub)
    return {
        "displays": [
            {"label": a.label, "agent_id": a.agent_id, "connected": a.connected(),
             "kept": [{"symbol": key, "name": agents.symbol_name(key), "taken_at": _iso(taken)}
                      for key, taken in kept.get(a.agent_id, [])]}
            for a in owned
        ],
    }


@tool
async def forget_display(
    display: str,
    npub: NPUB_FIELD = "",
    dpop_token: str = "",
) -> dict[str, Any]:
    """Remove one of your displays, and the secret it signed in with.

    Free. The machine stops receiving commands at once; pair it again with
    `chartremotely pair` if you want it back.

    Args:
        display: The display's name, or its agent_id when several share a name.
    """
    if err := await runtime.require_caller_proof(npub, dpop_token, "forget_display"):
        return err
    try:
        agent = await (await store()).forget(npub, display)
    except LookupError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "forgot": agent.label, "agent_id": agent.agent_id}


@tool
async def get_shortcut(npub: NPUB_FIELD = "", dpop_token: str = "") -> dict[str, Any]:
    """Get the Apple Shortcut for voice control.

    Import it, then say its name to Siri from any Apple device. The Shortcut
    ships without a token: paste yours into its one field after importing.
    A shared credential baked into a downloadable file is a published
    password, not a paywall.
    """
    return {
        "url": SHORTCUT_URL,
        "after_import": (
            "Open the shortcut, find the Get Contents of URL action, and put "
            "your token in the X-Token header field."
        ),
    }


# ---------------------------------------------------------------------------
# Metered tools
# ---------------------------------------------------------------------------


NO_ANSWER = "the display did not answer; is the agent running?"


def _iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, UTC).isoformat(timespec="seconds")


def _picture(agent: agents.Agent, jpeg: bytes, taken_at: str,
             symbol: str | None = None) -> ToolResult:
    """One picture of a display, as both an image block and its facts."""
    facts = {"ok": True, "display": agent.label, "agent_id": agent.agent_id,
             "taken_at": taken_at}
    if symbol is not None:
        facts |= {"symbol": symbol, "name": agents.symbol_name(symbol)}
    return ToolResult(
        content=[Image(data=jpeg, format="jpeg").to_image_content()],
        structured_content=facts,
    )


async def _relay(npub: str, display: str, command: str) -> tuple[agents.Agent, str]:
    """Send one command to one of the caller's displays and await its reply.

    Raises ValueError for anything that is not the caller's to pay for - an
    unknown display, or one that never answered - because ``paid_tool``
    rolls the debit back only when the body raises. Returning ``ok: False``
    instead kept the fare for a command that went nowhere.
    """
    db = await store()
    try:
        agent = await db.resolve(npub, display or None)
    except LookupError as exc:
        raise ValueError(str(exc)) from None
    try:
        return agent, await db.send(agent.agent_id, command)
    except TimeoutError:
        raise ValueError(NO_ANSWER) from None


@tool
@runtime.paid_tool(SHOW_CHART_UUID)
async def show_chart(
    security: str,
    scale: str = "",
    display: str = "",
    npub: NPUB_FIELD = "",
    dpop_token: str = "",
) -> dict[str, Any]:
    """Put a security on one of your displays.

    Args:
        security: Ticker or spoken company name — "PLTR", "Palantir", "john deere".
        scale: Time frame mnemonic: minute, scalp, quarter, half, hourly,
            swing, daily, weekly, ticks, micro. Omit to leave it unchanged.
        display: Which display, when several are paired. Omit if you have one.
    """
    agent, reply = await _relay(npub, display, f"set {security} | {scale}" if scale else security)
    return {"ok": not reply.startswith("ERR"), "display": agent.label, "result": reply}


@tool
@runtime.paid_tool(READ_CHART_UUID)
async def read_chart(
    display: str = "",
    npub: NPUB_FIELD = "",
    dpop_token: str = "",
) -> dict[str, Any]:
    """Report what one of your displays is currently showing.

    Args:
        display: Which display, when several are paired.
    """
    agent, reply = await _relay(npub, display, "read")
    return {"ok": not reply.startswith("ERR"), "display": agent.label, "result": reply}


@tool
@runtime.paid_tool(SNAPSHOT_UUID)
async def snapshot_display(
    display: str = "",
    npub: NPUB_FIELD = "",
    dpop_token: str = "",
) -> ToolResult | dict[str, Any]:
    """Take a picture of what one of your displays is showing, right now.

    Nothing is kept: the picture exists only in this reply. A display that
    is offline, or that cannot capture its chart, costs nothing.

    Args:
        display: Which display, when several are paired.
    """
    agent, reply = await _relay(npub, display, "snapshot")
    return _picture(agent, snapshot.parse(reply), datetime.now(UTC).isoformat(timespec="seconds"))


@tool
@runtime.paid_tool(LATEST_SNAPSHOT_UUID)
async def latest_snapshot(
    display: str = "",
    symbol: str = "",
    npub: NPUB_FIELD = "",
    dpop_token: str = "",
) -> ToolResult | dict[str, Any]:
    """Show a picture a display took after its chart changed.

    A display keeps the newest picture of each of its last 12 symbols,
    encrypted, each for an hour. None kept - or one older than that - costs
    nothing.

    Args:
        display: Which display, when several are paired.
        symbol: Which symbol's picture, e.g. "PLTR" (any case). Omit for the
            display's newest picture of any symbol.
    """
    db = await store()
    try:
        agent = await db.resolve(npub, display or None)
    except LookupError as exc:
        raise ValueError(str(exc)) from None
    wanted = agents.symbol_key(symbol) if symbol.strip() else None
    kept = await db.latest(agent.agent_id, wanted)
    if kept is None:
        what = f"no picture of {agents.symbol_name(wanted)}" if wanted else "no picture"
        raise ValueError(f"{agent.label} has {what} from the last hour")
    data_url, taken, key = kept
    return _picture(agent, snapshot.parse(data_url), _iso(taken), key)


# ---------------------------------------------------------------------------
# Agent transport — plain HTTP, because an agent is not an MCP client.
# Every route is agent-initiated: the operator never connects to a patron.
# ---------------------------------------------------------------------------


@mcp.custom_route("/agent/open", methods=["POST"])
async def agent_open(request: Request) -> JSONResponse:
    """An unpaired agent asks for a code to show its owner."""
    return JSONResponse({"code": await (await store()).open_code(),
                         "expires_in": agents.CODE_TTL_SECONDS})


@mcp.custom_route("/agent/collect", methods=["POST"])
async def agent_collect(request: Request) -> JSONResponse:
    """Has anyone adopted me yet?"""
    body = await request.json()
    claimed = await (await store()).collect(str(body.get("code", "")))
    if claimed is None:
        return JSONResponse({"paired": False})
    agent_id, secret = claimed
    return JSONResponse({"paired": True, "agent_id": agent_id, "secret": secret})


@mcp.custom_route("/agent/poll", methods=["POST"])
async def agent_poll(request: Request) -> JSONResponse:
    """Held open until a command arrives or the window closes.

    This is the whole reason a patron needs no open port.
    """
    body = await request.json()
    db = await store()
    agent = await db.authenticate(str(body.get("agent_id", "")), str(body.get("secret", "")))
    if agent is None:
        return JSONResponse({"error": "unknown agent"}, status_code=403)
    await db.touch(agent.agent_id)
    command = await db.next_for(agent.agent_id, get_settings().agent_poll_seconds)
    return JSONResponse(command or {})


@mcp.custom_route("/agent/snapshot", methods=["POST"])
async def agent_snapshot(request: Request) -> JSONResponse:
    """An agent's picture of its chart, taken just after the chart changed.

    Checked like any reply from a patron's machine, then kept sealed as that
    display's latest of the symbol it names (``symbol``, optional: without
    one it is kept as a plain "Chart"). Nothing is stored when it cannot be
    encrypted.
    """
    body = await request.json()
    db = await store()
    agent = await db.authenticate(str(body.get("agent_id", "")), str(body.get("secret", "")))
    if agent is None:
        return JSONResponse({"error": "unknown agent"}, status_code=403)
    image = str(body.get("image", ""))
    try:
        snapshot.parse(image)
        key = agents.symbol_key(body.get("symbol"))
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    try:
        await db.keep_latest(agent.agent_id, image, key)
    except RuntimeError:
        return JSONResponse({"error": "pictures cannot be stored right now"}, status_code=503)
    return JSONResponse({"kept": True})


@mcp.custom_route("/agent/result", methods=["POST"])
async def agent_result(request: Request) -> JSONResponse:
    """The agent's reply to one relayed command."""
    body = await request.json()
    db = await store()
    agent = await db.authenticate(str(body.get("agent_id", "")), str(body.get("secret", "")))
    if agent is None:
        return JSONResponse({"error": "unknown agent"}, status_code=403)
    ok = await db.deliver(str(body.get("id", "")), str(body.get("reply", "")))
    return JSONResponse({"accepted": ok})


if __name__ == "__main__":
    mcp.run()
