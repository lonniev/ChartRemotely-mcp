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

## Failure modes worth naming

| | |
|---|---|
| Agent offline | `show_chart` fails fast and refunds. It does not queue: a chart command is only meaningful now |
| Agent refuses | Out-of-vocabulary requests return the agent's refusal text, unmetered |
| Operator down | The patron's agent still works locally. Nothing about the local install depends on the operator |
