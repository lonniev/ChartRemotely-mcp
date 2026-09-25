/**
 * The pictures a display kept, one chip per symbol, newest first. A tap asks
 * for that symbol's picture; the one on screen is marked.
 */

import { formatTime } from "@tollbooth-dpyc/web";
import { useTimezone } from "@tollbooth-dpyc/web/react";
import type { KeptPicture } from "../lib/chart";
import { CLOCK } from "../lib/screens";

interface Props {
  kept: KeptPicture[];
  /** The symbol whose kept picture is on screen, if any. */
  showing?: string;
  disabled?: boolean;
  onPick: (symbol: string) => void;
}

export default function KeptStrip({ kept, showing, disabled, onPick }: Props) {
  const [, zone] = useTimezone();
  if (!kept.length) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-[var(--tb-line)] px-5 pt-3">
      {kept.map((k) => {
        const on = k.symbol === showing;
        return (
          <button
            key={k.symbol}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onPick(k.symbol)}
            title={`${k.name} at ${formatTime(k.taken_at, zone, CLOCK)}`}
            className={`inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm disabled:opacity-40 ${
              on
                ? "border-[var(--tb-accent)] bg-[var(--tb-accent)] text-[var(--tb-on-accent)]"
                : "border-[var(--tb-line)]"
            }`}
          >
            <span className="font-medium">{k.name}</span>
            <span className={`text-xs ${on ? "" : "text-[var(--tb-muted)]"}`}>{formatTime(k.taken_at, zone, CLOCK)}</span>
          </button>
        );
      })}
    </div>
  );
}
