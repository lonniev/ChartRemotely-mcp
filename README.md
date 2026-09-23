# ChartRemotely — operator

A Tollbooth-DPYC Operator MCP. It meters and relays chart commands to
agents running on patrons' own machines, so a security can be put on a wall
monitor anywhere by voice or by tool call.

The operator never touches a broker API and never drives a GUI itself. It
pairs agents, bills per request, and relays a narrow vocabulary.

## Why this exists

Desktop charting applications have no automation surface. thinkorswim in
particular has no API, no URL scheme, and nothing addressable — so
"put Palantir on the screen in the other building" is not a thing anyone
can currently buy.

The control plane is the product. Chart analysis is abundant; remote input
automation with a voice front end is not.

## Tools

| Tool | Price | What it does |
|---|---|---|
| `get_shortcut` | **free** | Returns the Apple Shortcut, ready to import |
| `pair_agent` | free | Binds an agent to the caller's npub |
| `agent_status` | free | Which agents are paired, and are they connected |
| `show_chart` | metered | Put a security on a paired display |
| `read_chart` | metered | What a display is currently showing |

`show_chart` returns a cropped image of the chart's own window buffer. A
remote command you cannot see is otherwise indistinguishable from one that
silently failed.

## What it deliberately cannot do

The vocabulary relayed to an agent is fixed, and the agent enforces it
independently — see [`vocab.py`](https://github.com/lonniev/ChartRemotely-agent/blob/main/chartremotely/vocab.py)
in the agent repository. Nothing in this operator can reach an order
ticket, an account balance, or a position. Widening that surface would
require changes in both repositories, in public.

## Related

- [ChartRemotely-agent](https://github.com/lonniev/ChartRemotely-agent) — runs on the patron's Mac
- [ChartRemotely](https://github.com/lonniev/ChartRemotely) — landing page

## License

Apache-2.0
