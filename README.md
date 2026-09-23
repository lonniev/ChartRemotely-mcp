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

## Web app

`frontend/` is the site at <https://chartremotely.tollbooth-dpyc.com>: a welcome page, npub
sign-in, a carousel of your screens with a live snapshot on request, and a profile for your
balance and paired displays. It is built on
[`@tollbooth-dpyc/web`](https://github.com/lonniev/tollbooth-web), the shared browser SDK,
and deploys to Cloudflare Pages through the fleet's shared workflow on every push to main
that touches `frontend/`.

```sh
cd frontend && npm install && npm run dev   # tests run as part of npm run build
```

## Tools

| Tool | Price | What it does |
|---|---|---|
| `get_shortcut` | **free** | Returns the Apple Shortcut, ready to import |
| `pair_agent` | free | Binds an agent to the caller's npub |
| `agent_status` | free | Which displays are paired, and are they connected |
| `forget_display` | free | Removes a display and the secret it signed in with |
| `show_chart` | metered | Put a security on a paired display |
| `read_chart` | metered | What a display is currently showing |
| `snapshot_display` | metered | A JPEG of the display's chart window, right now |

Every tool that takes an npub needs a proof of that npub (`request_npub_proof`,
then `receive_npub_proof`); `get_shortcut` hands out a public file and does not.

A metered call to a display that never answers - offline, or not running the
agent - is refunded, and so is one naming a display you do not have.
`snapshot_display` keeps nothing: the picture exists only in the reply, so a
remote command you cannot see is no longer indistinguishable from one that
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
