# Agent protocol

How the operator reaches a display it does not own.

## Design constraints

**The work is irreducibly local.** Driving a desktop chart means
synthesising input into a GUI on a specific machine. A remote MCP can never
do that directly, so the operator is a broker and the agent is the executor.

**The agent dials out.** The patron's machine holds an outbound connection
to the operator and never listens on a public port. No Funnel, no NAT
traversal, no firewall rules, and nothing on the patron's network is
reachable from the internet. This is the single most important choice here:
the alternative — each patron exposing an HTTPS endpoint — is worse in every
respect.

**The agent is the final authority on what it will do.** The operator
relays a request; the agent decides whether it is in the vocabulary. A
compromised operator cannot widen the surface.

## Pairing

Binding an agent to an npub, without the patron ever sending a credential
to their own machine.

```
1. patron installs the agent and runs:  chartremotely pair
   -> the agent prints a short pairing code and begins polling

2. patron calls pair_agent(code, label) on the operator
   -> operator binds npub <-> agent, mints an agent secret

3. the agent's next poll returns the secret and its assigned agent id
   -> it persists both and opens the relay connection

4. the code expires: single use, short lived
```

The patron proves a machine is theirs. They never hand over access to it.

## Relay

```
agent                                   operator
  |--- connect + agent id + secret ------->|
  |<-- accepted ---------------------------|
  |                                        |
  |<-- {id, "set PLTR | scalp"} -----------|   (after debiting the npub)
  |--- {id, "Showing PLTR at scalp.",      |
  |         proof: <png>} ---------------->|
```

Commands are the agent's own vocabulary, verbatim. The operator does not
parse or rewrite them; it meters, routes, and returns the reply.

## Metering

The npub is debited **before** the command is relayed, and refunded if the
agent reports failure or does not answer within the timeout. Free tools are
never metered.

## Multiple displays

One npub may pair several agents — a desk, a wall, a second location. Each
gets an id and a patron-supplied label, so `show_chart(symbol, display:
"east wall")` addresses one of them. A patron with a single agent may omit
it.

## Forwarding between displays

A voice command is heard by one Mac, and every chart change it hears goes to
the operator - one for that same Mac included (it names its own agent_id). The
hearing agent posts to `/agent/forward`:

```
{agent_id, secret, display: "<name as dictated, or its own agent_id>", cmd: "set PLTR | daily"}
```

The operator authenticates the caller, finds `display` among the caller's
owner's displays only — by agent_id, or by a loosely matched name (see
"Naming a display") — and charges the owner exactly what `chart_show_chart`
would: the same price, constraint chain and ledger entry, taken through the
wheel's own pricing and billing stages. The caller's pairing secret stands in
for the npub proof: pairing bound it to that npub with the npub's own proof.
Then it answers **202** `{accepted, display, symbol?, scale?}` at once and
relays `cmd` opaque in the background; the chart changes by itself. A target
that never answers is refunded and logged; an answered command keeps its fare,
as a tool call does.

Only a chart change is forwarded: `set <TICKER> | <scale>` or a bare company
name. `resolve`, `scale`, `read` and `snapshot` are 400. Refusals are
immediate: 402 insufficient balance (the wheel's words, in `error`), 403 a
constraint denied it, 404 with the owner's names (`displays`), 409 with the
displays the name could mean (`candidates`), 503 an offline target or a
service that cannot price right now.

## Naming a display

Every tool's `display` and `/agent/forward` resolve a name the same way, in
the operator only (agents pass what was said through verbatim). Rules are
tried in order and the first that finds anything decides:

1. the same name ignoring case, spaces, hyphens, underscores and dots
   ("mac-mini" is "Mac Mini"), or the exact agent_id;
2. the same words in any order ("mini mac");
3. every word said is a word of the name ("mini", "office" for "office wall");
4. the start of the name ("macm");
5. rules 2 and 3 on American Soundex codes, word by word ("mack meeny").

One hit is the display. Several: the one live display among them, if exactly
one is live; otherwise refused with the candidates. None: refused with the
owner's names. Deterministic, no model.

## Failure modes worth naming

| | |
|---|---|
| Agent offline | `show_chart` fails fast and refunds. It does not queue: a chart command is only meaningful now |
| Agent refuses | Out-of-vocabulary requests return the agent's refusal text, unmetered |
| Operator down | The patron's agent still works locally. Nothing about the local install depends on the operator |
