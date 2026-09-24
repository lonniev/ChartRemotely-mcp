# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
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
