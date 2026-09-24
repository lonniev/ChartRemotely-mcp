# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

### Changed
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

### Migration
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
