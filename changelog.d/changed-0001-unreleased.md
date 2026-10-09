- A display now keeps its last 20 symbols (was 12), and every capture for four hours (was two). Same 6 captures per symbol; the sweep, the caps and the tools' words all follow the constants in `agents.py`.
- Web app: a picture opened full screen is a carousel of every kept capture, newest symbol first - swipe (or arrow) left and right through a symbol's captures and straight on into the next symbol's. The page underneath follows, so closing lands on the capture last looked at. A capture is still fetched only when it comes to rest in view, once per visit.
- Kept pictures are now a short history per symbol: the newest 6 captures of each of a display's last 12 symbols, each kept for two hours (was one picture per symbol for an hour). New table `chart_captures` keyed `(agent_id, capture_id)`; the AAD binds agent, symbol and capture id. `chart_pictures` is dropped, not copied - its rows were sealed without a capture id and gone within the hour anyway. Idempotent.
- `chart_agent_status` lists each kept symbol with its `captures: [{id, taken_at, scale?}]`, newest first; symbols are ordered by their newest capture.
- `chart_latest_snapshot` takes `capture` (a 16-hex-digit id from status) to show one capture exactly; same tool, same price. A malformed id is refused before any lookup and costs nothing.
- `chart_snapshot_display` now keeps its picture as a capture, filed under the symbol the display reports with `read` ("Chart" when it will not say). Keeping is best effort: a picture that cannot be sealed is still returned, and still costs one fare.
- Web app: My Screens browses by symbol, then by capture - a symbol carousel merged across displays, and within a symbol a carousel of its captures, each picture fetched only when its slide is in view. Before anything is kept, ghosted example cards show the idea.

- Display names match the same way everywhere a tool takes `display`: case,
  spaces, hyphens, underscores and dots do not count. Several displays under
  one name are refused with their ids unless exactly one is live (before, the
  oldest was picked and the command timed out on it).
- A display keeps a picture per symbol: the newest of each of its last 12
  symbols, each for an hour. `POST /agent/snapshot` takes an optional
  `symbol` (validated; a picture without one is kept as "Chart"), and the AAD
  now binds display AND symbol.
- `chart_latest_snapshot` takes `symbol` (any case); omitted, it shows the
  display's newest picture of any symbol.
- `chart_agent_status` returns `kept` per display — symbol, name and taken_at,
  newest first — in place of `latest_at`.
- Web app: each screen shows its kept symbols as chips under the picture;
  a tap shows that symbol's.
