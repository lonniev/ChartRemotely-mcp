ChartRemotely is a web app at https://chartremotely.tollbooth-dpyc.com and an MCP server that AI assistants can call.
Desktop charting applications have no API.
ChartRemotely relays commands to a small agent running on your own Mac, which drives the chart through the accessibility layer.
The agent dials out, so nothing on your network is exposed.

## Getting started

1. Install the agent on the Mac that shows the chart: https://github.com/lonniev/ChartRemotely-agent
2. Run `chartremotely pair` on that Mac. It prints a code.
3. Call `chart_pair_agent(code, label)` to adopt it.
4. Call `chart_get_shortcut` for the Apple Shortcut, which lets you put a security on the chart by voice.

## What it does

- `chart_show_chart` puts a security on a display's chart.
- `chart_read_chart` reads what a display's chart shows.
- `chart_snapshot_display` returns a picture of a display, and keeps it.
- `chart_latest_snapshot` returns a kept picture: the newest, a symbol's newest, or one capture by its id.
- `chart_agent_status` lists your displays and whether each is live; `chart_forget_display` removes one.

A display keeps the newest 6 captures of each of its last 20 symbols, encrypted, each for four hours.

## Prices

Pairing, status, forgetting a display and the Shortcut are free.
Showing, reading and snapshotting a chart are metered, and a display that does not answer costs nothing.

## Pages

- How it works: https://chartremotely.tollbooth-dpyc.com/#/how
- Prices: https://chartremotely.tollbooth-dpyc.com/#/prices
- Getting started: https://chartremotely.tollbooth-dpyc.com/#/start
