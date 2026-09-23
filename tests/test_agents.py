"""Pairing and relay. Pure logic - no MCP, no network, no billing."""

import asyncio
import time

import pytest

from chartremotely_mcp import agents


def test_pairing_code_avoids_ambiguous_glyphs():
    """Codes get read aloud or typed off a screen across the room, so the
    pairs people confuse must not appear."""
    code = agents.new_pairing_code()
    assert len(code) == agents.CODE_LENGTH
    assert not set(code) & set("01IO")


def test_claim_binds_an_agent_to_an_npub():
    reg = agents.Registry()
    code = reg.open_code()
    agent = reg.claim(code, "npub1alice", "east wall")
    assert agent.npub == "npub1alice"
    assert reg.for_npub("npub1alice") == [agent]


def test_a_code_works_once():
    reg = agents.Registry()
    code = reg.open_code()
    reg.claim(code, "npub1alice", "wall")
    with pytest.raises(KeyError):
        reg.claim(code, "npub1mallory", "mine now")


def test_the_agent_collects_its_secret_once():
    reg = agents.Registry()
    code = reg.open_code()
    reg.claim(code, "npub1alice", "wall")
    first = reg.collect(code)
    assert first is not None
    assert reg.collect(code) is None      # single use


def test_unknown_and_expired_codes_are_refused():
    reg = agents.Registry()
    with pytest.raises(KeyError):
        reg.claim("ZZZZZZ", "npub1alice", "wall")
    code = reg.open_code()
    reg._codes[code].created_at = time.time() - agents.CODE_TTL_SECONDS - 1
    with pytest.raises(KeyError):
        reg.claim(code, "npub1alice", "wall")


def test_authentication_requires_the_right_secret():
    reg = agents.Registry()
    agent = reg.claim(reg.open_code(), "npub1alice", "wall")
    assert reg.authenticate(agent.agent_id, agent.secret) is agent
    assert reg.authenticate(agent.agent_id, "wrong") is None
    assert reg.authenticate("nobody", agent.secret) is None


def test_one_display_needs_no_name_and_several_do():
    reg = agents.Registry()
    east = reg.claim(reg.open_code(), "npub1alice", "east wall")
    assert reg.resolve("npub1alice", None) is east

    reg.claim(reg.open_code(), "npub1alice", "desk")
    with pytest.raises(LookupError, match="name one"):
        reg.resolve("npub1alice", None)
    assert reg.resolve("npub1alice", "east wall") is east


def test_displays_are_scoped_to_their_owner():
    reg = agents.Registry()
    reg.claim(reg.open_code(), "npub1alice", "wall")
    with pytest.raises(LookupError):
        reg.resolve("npub1mallory", None)


async def test_a_command_reaches_a_waiting_agent():
    relay = agents.Relay()
    sent = asyncio.create_task(relay.send("agent1", "set PLTR | scalp"))
    await asyncio.sleep(0)
    envelope = await relay.next_for("agent1", timeout=1)
    assert envelope["command"] == "set PLTR | scalp"
    relay.deliver(envelope["id"], "Showing PLTR at scalp. Good luck.")
    assert await sent == "Showing PLTR at scalp. Good luck."


async def test_nothing_is_queued_for_an_absent_agent():
    """A chart command is only meaningful now. Timing out is the correct
    outcome, and the caller must refund rather than deliver it later."""
    relay = agents.Relay()
    with pytest.raises(TimeoutError):
        await relay.send("offline", "read", timeout=0.05)


async def test_an_idle_poll_returns_nothing():
    relay = agents.Relay()
    assert await relay.next_for("agent1", timeout=0.05) is None


def test_connected_is_derived_from_the_last_poll():
    reg = agents.Registry()
    agent = reg.claim(reg.open_code(), "npub1alice", "wall")
    assert not agent.connected()
    agent.last_seen = time.time()
    assert agent.connected()
