# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

Changes not yet released live in `changelog.d/`, one file per change — see the README there for why, and `scripts/changelog.py` for what folds them in at release time.

## [0.4.0] — 2026-10-21

### Added

- Picture replies (`snapshot_display`, `latest_snapshot`) now carry a one-line text summary before the image - display, symbol, scale and capture time, leaving out whatever is unknown - so the facts survive a client dropping images when it compacts, and reach a client that cannot render images at all. Same tools, same price; `structured_content` gains `scale`.
- A kept picture remembers the scale its display stated (new nullable `scale` column on `chart_pictures`, added idempotently). `/agent/snapshot` accepts an optional `scale`; one that is not a short printable label (24 characters at most) is dropped and the picture kept.
- Display names match loosely, the same way for every tool's `display` and
  for `/agent/forward`: dictation's "mini mac", "mini", "macm" and even
  "mack meeny" find "Mac mini". Deterministic rules tried in order, the first
  with a hit deciding - exact name (case/space/hyphen/underscore/dot
  ignored) or agent_id; same words in any order; a subset of its words; a
  prefix; then American Soundex per word (same, then subset). Several hits
  resolve to the one live display, else refused: tools name every candidate
  as `label (agent_id)`, while `/agent/forward`'s 409 `error` is spoken and so
  carries names only ("Which one: Mac mini or Mac studio?", or "Two displays
  are named Mac mini; rename one at chartremotely.tollbooth-dpyc.com.").
  None is 404 with your names. Still owner-scoped
  only. The matcher is `displays.match`, pure and dependency-free.
- `POST /agent/forward`: a paired display hands a command to another display
  of the SAME owner, by name, and gets its reply back to speak — so "Hey Siri,
  ChartRemotely … Where? Mac mini" reaches the Mac mini from whichever Mac
  heard it. The caller authenticates like `/agent/snapshot`; the target is
  looked up only among the caller's owner's displays, by agent_id or by name
  ignoring case, spaces, hyphens, underscores and dots. No fuzzy matching.
  404 lists the owner's display names, 409 lists twins, 503 when the target is
  offline, 504 when it does not answer in 25 s; `{"self": true}` when the name
  is the caller's own. Command and name are capped (200 / 64 printable
  characters). Unmetered.

- A Prices page (`#/prices`), linked from the Welcome page and its footer:
  every tool with what it does and its live fare, and how long a top-up lasts.
  It is the fleet's `PriceSheet` on the trading-desk palette, with the fares
  set like a quote board. It needs `@tollbooth-dpyc/web` 2.2.0.

### Changed

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

- Connections authenticate as holders (tollbooth-dpyc 0.101.1 holder bearer): connecting from Claude.ai is an Authorization Code flow with no login page, each npub proven through a connection stays with it, and tool calls pass only `npub`. The web app moves to @tollbooth-dpyc/web 1.8.2, whose proxy carries a bearer. Needs chartremotely agent with the anonymous-bearer fix.

- Every ChartRemotely tool now carries a plain-words title, its read/write/open-world hints and a description for each parameter, and the server announces itself as chartremotely-mcp with its version, website and icon.

- Pins tollbooth-dpyc 0.102.0: a request signed with an npub's own key (NIP-98) acts as that npub with no grant.

- Pins tollbooth-dpyc 0.102.1: a request signed with an npub's own key (NIP-98) acts as that npub with no grant.

- Dependencies refreshed to current releases (mcp/fastmcp 2.2.0/4.0.5 → 2.3.0/4.1.0; frontend minor/patch). No service stays on old transitive versions.

- Tools take only `npub`; the connection proves it (a request signed with the npub's key, or an OAuth connection that holds it after the DM). The `dpop_token` argument is gone, and the Courier phrase is `nonce`. Pins tollbooth-dpyc 0.103.0.

- The web app moves to @tollbooth-dpyc/web 1.9.0: a tab that holds the signed-in key signs each request, and DM sign-in connects to the operator as a holder (one quick redirect, no login page) — no proof rides in tool arguments.

### Notes

- `chart_pictures` replaces `chart_latest`, which is dropped on start-up. Its
  pictures were disposable (sealed, an hour at most), so none are carried over.

## [0.3.0] - 2026-09-24

### Added
- Each display keeps its latest picture. After a chart change, the agent
  pushes a cropped snapshot to the new `POST /agent/snapshot`; the operator
  keeps only the newest per display, sealed with the SDK's vault cipher (AAD
  binds it to its display), for an hour — and stores nothing when it cannot
  encrypt.
- `chart_latest_snapshot` (metered): shows that kept picture. None kept, or
  one past its hour, costs nothing.
- `chart_agent_status` reports `latest_at` per display, read from the
  unencrypted timestamp.
- Web app: Screens re-reads the free status every 30 seconds while open, and
  a display whose chart changed shows "Changed 10:42 · tap to view".

### Changed
- `chart_forget_display` also removes the display's kept picture.

## [0.2.0] - 2026-09-23

### Added
- `chart_snapshot_display` (metered): a JPEG of what a display shows, taken
  now and kept nowhere. The agent's reply is validated as untrusted input -
  JPEG data URL, bounded size, real JPEG bytes - before it is returned.
- `chart_forget_display` (free): removes one of the caller's displays, its
  queued commands and pairing rows, and its vault secret. A name shared by
  several displays is refused; name one by its agent_id.

### Changed
- `chart_pair_agent`, `chart_agent_status` and `chart_forget_display` now
  require a proof of the caller's npub. Before, anyone knowing an npub could
  list its displays.
- A metered call to a display that never answers, or to a display name the
  caller does not have, is refunded. It used to return `ok: false` and keep
  the fare.
- When several displays share a name, commands go to the connected one.
