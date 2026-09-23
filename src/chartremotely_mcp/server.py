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
from typing import Annotated, Any

from fastmcp import FastMCP
from pydantic import Field
from starlette.requests import Request
from starlette.responses import JSONResponse
from tollbooth.credential_templates import CredentialTemplate, FieldSpec
from tollbooth.credential_validators import validate_btcpay_creds
from tollbooth.runtime import OperatorRuntime, register_standard_tools
from tollbooth.tool_identity import STANDARD_IDENTITIES, ToolIdentity

from chartremotely_mcp import __version__, agents
from chartremotely_mcp.config import get_settings

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
        "## Pricing\n"
        "Pairing, status and the Shortcut are free — charging for setup "
        "taxes the wrong thing. chart_show_chart and chart_read_chart are "
        "metered. Use `chart_check_price` to preview and "
        "`chart_check_balance` to see your balance."
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

# Process-local for now; the Authority provisions Neon for exactly this.
REGISTRY = agents.Registry()
RELAY = agents.Relay()

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
    try:
        agent = REGISTRY.claim(code, npub, label)
    except KeyError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "display": agent.label, "agent_id": agent.agent_id}


@tool
async def agent_status(npub: NPUB_FIELD = "", dpop_token: str = "") -> dict[str, Any]:
    """List the displays paired to you, and whether each is connected."""
    owned = REGISTRY.for_npub(npub)
    return {
        "displays": [
            {"label": a.label, "agent_id": a.agent_id, "connected": a.connected()}
            for a in owned
        ],
    }


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
    try:
        agent = REGISTRY.resolve(npub, display or None)
    except LookupError as exc:
        return {"ok": False, "error": str(exc)}
    command = f"set {security} | {scale}" if scale else security
    try:
        reply = await RELAY.send(agent.agent_id, command)
    except TimeoutError:
        return {"ok": False, "display": agent.label,
                "error": "the display did not answer; is the agent running?"}
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
    try:
        agent = REGISTRY.resolve(npub, display or None)
    except LookupError as exc:
        return {"ok": False, "error": str(exc)}
    try:
        reply = await RELAY.send(agent.agent_id, "read")
    except TimeoutError:
        return {"ok": False, "display": agent.label, "error": "the display did not answer"}
    return {"ok": not reply.startswith("ERR"), "display": agent.label, "result": reply}


# ---------------------------------------------------------------------------
# Agent transport — plain HTTP, because an agent is not an MCP client.
# Every route is agent-initiated: the operator never connects to a patron.
# ---------------------------------------------------------------------------


@mcp.custom_route("/agent/open", methods=["POST"])
async def agent_open(request: Request) -> JSONResponse:
    """An unpaired agent asks for a code to show its owner."""
    return JSONResponse({"code": REGISTRY.open_code(),
                         "expires_in": agents.CODE_TTL_SECONDS})


@mcp.custom_route("/agent/collect", methods=["POST"])
async def agent_collect(request: Request) -> JSONResponse:
    """Has anyone adopted me yet?"""
    body = await request.json()
    claimed = REGISTRY.collect(str(body.get("code", "")))
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
    agent = REGISTRY.authenticate(str(body.get("agent_id", "")), str(body.get("secret", "")))
    if agent is None:
        return JSONResponse({"error": "unknown agent"}, status_code=403)
    import time as _time
    agent.last_seen = _time.time()
    command = await RELAY.next_for(agent.agent_id, get_settings().agent_poll_seconds)
    return JSONResponse(command or {})


@mcp.custom_route("/agent/result", methods=["POST"])
async def agent_result(request: Request) -> JSONResponse:
    """The agent's reply to one relayed command."""
    body = await request.json()
    agent = REGISTRY.authenticate(str(body.get("agent_id", "")), str(body.get("secret", "")))
    if agent is None:
        return JSONResponse({"error": "unknown agent"}, status_code=403)
    ok = RELAY.deliver(str(body.get("id", "")), str(body.get("reply", "")))
    return JSONResponse({"accepted": ok})


if __name__ == "__main__":
    mcp.run()
