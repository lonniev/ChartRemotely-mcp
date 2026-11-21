## What to tell a person about ChartRemotely

ChartRemotely is for a trader whose charts live in a desktop app on their Mac, and who wants to drive them from anywhere.
They say "show me Apple on the big screen" to their phone or their AI assistant, and the chart on their desk changes.

What a trader gets:

- **Their own charting app, by voice or by agent.** Put a security on a display's chart from an Apple Shortcut, an AI assistant, or the web app.
- **What the chart shows, read back.** The symbol and what the chart is showing, as text an assistant can use.
- **A picture when they want one.** A snapshot of a display, kept encrypted for four hours, so they can look again later.
- **Nothing exposed.** A small agent on their Mac dials out to ChartRemotely and drives the chart through the accessibility layer; no port on their network opens.
- **Fair prices.** Pairing, status and the Shortcut are free. Showing, reading and snapshotting are metered, and a display that does not answer costs nothing.
- **No account.** They sign in with a Nostr key and pay in Bitcoin Lightning.

A good one-line pitch: *"Your desktop charts, on command from your phone or your AI assistant, with nothing opened on your network."*

## For agents

Desktop charting applications have no API, so ChartRemotely relays each command to the agent on the trader's Mac.
`tools/list` and each tool's description carry the arguments.

1. The trader installs the agent on the Mac that shows the chart: https://github.com/lonniev/ChartRemotely-agent
2. They run `chartremotely pair` there, and it prints a code.
3. `chart_pair_agent` adopts the agent with that code; the Apple Shortcut is free from `chart_get_shortcut`.

A display keeps the newest 6 captures of each of its last 20 symbols, encrypted, each for four hours.

## Pages

- How it works: https://chartremotely.tollbooth-dpyc.com/#/how
- Prices: https://chartremotely.tollbooth-dpyc.com/#/prices
- Getting started: https://chartremotely.tollbooth-dpyc.com/#/start
