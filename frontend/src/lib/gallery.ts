/**
 * Pure rules for My Screens as a gallery: symbols first, then captures.
 * Testable under node:test.
 */

export interface CaptureLike {
  id: string;
  taken_at: string;
  scale?: string;
}

export interface KeptLike {
  symbol: string;
  name: string;
  captures: CaptureLike[];
}

export interface DisplayWithKept {
  agent_id: string;
  label: string;
  kept?: KeptLike[];
}

/** One capture, knowing which display took it. */
export interface GalleryCapture extends CaptureLike {
  agentId: string;
  display: string;
}

/** One symbol across every display, its captures newest first. */
export interface SymbolGroup {
  symbol: string;
  name: string;
  captures: GalleryCapture[];
  /** The newest capture's time: what the groups are ordered by. */
  lastAt: string;
}

const at = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Every display's kept symbols merged into one list: a symbol captured on two
 * displays is one group. Groups by their newest capture, newest first;
 * captures newest first, ties broken by id so the order never flickers.
 * ``names`` shows a display the way the rest of the page does.
 */
export function groupBySymbol(displays: DisplayWithKept[], names: Map<string, string>): SymbolGroup[] {
  const groups = new Map<string, { name: string; captures: GalleryCapture[] }>();
  for (const d of displays) {
    const display = names.get(d.agent_id) ?? d.label;
    for (const k of d.kept ?? []) {
      const g = groups.get(k.symbol) ?? { name: k.name, captures: [] };
      for (const c of k.captures ?? []) g.captures.push({ ...c, agentId: d.agent_id, display });
      groups.set(k.symbol, g);
    }
  }
  const newestFirst = (a: GalleryCapture, b: GalleryCapture) =>
    at(b.taken_at) - at(a.taken_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  return [...groups]
    .map(([symbol, g]) => {
      const captures = [...g.captures].sort(newestFirst);
      return { symbol, name: g.name, captures, lastAt: captures[0]?.taken_at ?? "" };
    })
    .filter((g) => g.captures.length > 0)
    .sort((a, b) => at(b.lastAt) - at(a.lastAt) || a.symbol.localeCompare(b.symbol));
}

/** Where a key sits in a list, or 0 when it is not there (the newest leads). */
export function indexOr0<T>(items: T[], matches: (item: T) => boolean): number {
  const i = items.findIndex(matches);
  return i < 0 ? 0 : i;
}

/** "1 capture", "3 captures". */
export function captureCount(n: number): string {
  return `${n} capture${n === 1 ? "" : "s"}`;
}

/** The symbols the empty page shows as examples. Never real data. */
export const EXAMPLE_SYMBOLS = [
  // GE leads: the example capture under it is a real GE chart.
  { symbol: "GE", count: 4, minutesAgo: 3 },
  { symbol: "PLTR", count: 2, minutesAgo: 26 },
  { symbol: "SHOP", count: 6, minutesAgo: 71 },
] as const;
