/**
 * Pure rules for the Screens carousel, testable under node:test.
 */

export interface DisplayLike {
  label: string;
  agent_id: string;
  connected: boolean;
}

/** Live displays first, then by name — the one you can look at leads. */
export function orderDisplays<T extends DisplayLike>(displays: T[]): T[] {
  return [...displays].sort(
    (a, b) => Number(b.connected) - Number(a.connected) || a.label.localeCompare(b.label),
  );
}

/**
 * Names shown on slides and in the list. Two displays with one name are told
 * apart by a short piece of their id, so a patron never removes the wrong one.
 */
export function displayNames<T extends DisplayLike>(displays: T[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const d of displays) counts.set(d.label, (counts.get(d.label) ?? 0) + 1);
  return new Map(
    displays.map((d) => [
      d.agent_id,
      (counts.get(d.label) ?? 0) > 1 ? `${d.label} · ${d.agent_id.slice(0, 4)}` : d.label,
    ]),
  );
}

/** "just now", "4 min ago", "2 h ago", or the time for anything older than a day. */
export function takenAgo(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleString();
}

/** A pairing code as typed: upper case, no spaces, the agent's alphabet only. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
}

/** Wrap an index into [0, n). */
export function wrapIndex(i: number, n: number): number {
  return n === 0 ? 0 : ((i % n) + n) % n;
}

/**
 * Whether a display has kept a picture newer than the one on screen — the cue
 * to offer "Changed · tap to view". Nothing shown yet counts as older.
 */
export function hasNewer(latestAt: string | null | undefined, shownAt: string | undefined): boolean {
  if (!latestAt) return false;
  const kept = Date.parse(latestAt);
  if (Number.isNaN(kept)) return false;
  return !shownAt || kept > Date.parse(shownAt);
}

/** "10:42" in the viewer's own clock. */
export function clockTime(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
