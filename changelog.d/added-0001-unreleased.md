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
