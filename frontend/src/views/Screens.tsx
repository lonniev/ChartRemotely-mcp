/**
 * Every paired screen, one slide each, and a picture of it on request.
 *
 * No picture is fetched by itself: every one is a paid request, so each waits
 * for a tap. What does refresh is the free status list, so a display whose
 * chart just changed says so — "Changed 10:42 · tap to view" — and a tap shows
 * the picture it kept. A display keeps the newest picture of each of its last
 * twelve symbols, for an hour each; they sit as chips under the big picture,
 * newest first, and a tap on one shows that symbol's.
 */

const STATUS_EVERY_MS = 30_000;

import { useCallback, useEffect, useState } from "react";
import { Camera, Eye, MonitorOff, MonitorPlay, Plus, X } from "lucide-react";
import { ProofRequiredError } from "@tollbooth-dpyc/web";
import { QuoteScroller } from "@tollbooth-dpyc/web/react";
import Carousel from "../components/Carousel";
import KeptStrip from "../components/KeptStrip";
import { listDisplays, takeLatest, takeSnapshot, type Display, type Snapshot } from "../lib/chart";
import { go } from "../lib/route";
import { clockTime, displayNames, hasNewer, orderDisplays, takenAgo } from "../lib/screens";
import { pictureQuoteStyles, quoteStyles } from "../lib/quoteStyles";
import { TRADING_QUOTES } from "../lib/tradingQuotes";

interface Shot {
  snap?: Snapshot;
  busy?: boolean;
  error?: string;
}

export default function Screens() {
  const [displays, setDisplays] = useState<Display[] | null>(null);
  const [error, setError] = useState("");
  const [shots, setShots] = useState<Record<string, Shot>>({});
  const [zoomed, setZoomed] = useState<{ name: string; snap: Snapshot } | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(() => {
    setError("");
    listDisplays()
      .then((d) => setDisplays(orderDisplays(d)))
      .catch((e) => !(e instanceof ProofRequiredError) && setError((e as Error).message));
  }, []);

  useEffect(load, [load]);

  // The status list is free; re-read it while the page is being looked at, so
  // a chart changed by voice shows up here without a reload.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      listDisplays()
        .then((d) => setDisplays(orderDisplays(d)))
        .catch(() => {});
    }, STATUS_EVERY_MS);
    return () => clearInterval(t);
  }, []);

  // Keeps "4 min ago" honest without re-fetching anything.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  /** A live picture, or — given a symbol ("" for the newest) — one the display kept. */
  async function shoot(agentId: string, kept?: string) {
    setShots((s) => ({ ...s, [agentId]: { ...s[agentId], busy: true, error: undefined } }));
    try {
      const snap = await (kept === undefined ? takeSnapshot(agentId) : takeLatest(agentId, kept));
      setShots((s) => ({ ...s, [agentId]: { snap } }));
    } catch (e) {
      if (e instanceof ProofRequiredError) return;
      setShots((s) => ({ ...s, [agentId]: { ...s[agentId], busy: false, error: (e as Error).message } }));
    }
  }

  if (displays === null && !error) {
    return (
      <div className="mx-auto max-w-2xl py-14">
        <QuoteScroller quotes={TRADING_QUOTES} heading="Finding your screens…" spinner classNames={quoteStyles} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm">
        <p className="mb-4 text-[var(--tb-err-ink)]">{error}</p>
        <button type="button" onClick={load} className="rounded-full border border-[var(--tb-line)] px-4 py-2">
          Try again
        </button>
      </div>
    );
  }

  if (!displays?.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <MonitorPlay className="mx-auto mb-4 text-[var(--tb-muted)]" size={40} />
        <p className="mb-6 text-[var(--tb-muted)]">No screens paired yet.</p>
        <button
          type="button"
          onClick={() => go("profile")}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--tb-accent)] px-5 py-2.5 font-medium text-[var(--tb-on-accent)]"
        >
          <Plus size={18} /> Pair a screen
        </button>
      </div>
    );
  }

  const names = displayNames(displays);

  return (
    <div className="py-6">
      <Carousel label="Your screens">
        {displays.map((d) => {
          const name = names.get(d.agent_id) ?? d.label;
          const shot = shots[d.agent_id] ?? {};
          const kept = d.kept ?? [];
          const newest = kept[0];
          return (
            <figure
              key={d.agent_id}
              className="overflow-hidden rounded-[28px] border border-[var(--tb-line)] bg-[var(--tb-surface)]"
            >
              <div className="relative aspect-[16/10] bg-black">
                {shot.snap ? (
                  <button
                    type="button"
                    onClick={() => setZoomed({ name, snap: shot.snap! })}
                    aria-label={`Open ${name} full screen`}
                    className="block h-full w-full"
                  >
                    <img src={shot.snap.src} alt={`What ${name} is showing`} className="h-full w-full object-contain" />
                  </button>
                ) : shot.busy ? null : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--tb-muted)]">
                    {d.connected ? <MonitorPlay size={44} /> : <MonitorOff size={44} />}
                    <span className="text-sm">{d.connected ? "Tap the camera to look" : "Offline"}</span>
                  </div>
                )}
                {!shot.busy && newest && hasNewer(newest.taken_at, shot.snap?.takenAt) && (
                  <button
                    type="button"
                    onClick={() => void shoot(d.agent_id, newest.symbol)}
                    className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--tb-accent)] px-3 py-1.5 text-xs font-medium text-[var(--tb-on-accent)] shadow"
                  >
                    <Eye size={14} /> {newest.name} {clockTime(newest.taken_at)} · tap to view
                  </button>
                )}
                {shot.busy && (
                  // Inside the picture's fixed-ratio box, so nothing moves when it arrives.
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black/85">
                    <QuoteScroller
                      quotes={TRADING_QUOTES}
                      heading="Fetching your chart…"
                      spinner
                      classNames={pictureQuoteStyles}
                    />
                  </div>
                )}
              </div>

              <KeptStrip
                kept={kept}
                showing={shot.snap?.symbol}
                disabled={shot.busy}
                onPick={(symbol) => void shoot(d.agent_id, symbol)}
              />

              <figcaption className="flex items-center gap-3 px-5 py-4">
                <span
                  className={`h-2.5 w-2.5 flex-none rounded-full ${d.connected ? "bg-[var(--tb-ok)]" : "bg-[var(--tb-line)]"}`}
                  title={d.connected ? "Connected" : "Offline"}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{name}</div>
                  <div className="truncate text-xs text-[var(--tb-muted)]">
                    {shot.error ? (
                      <span className="text-[var(--tb-err-ink)]">{shot.error}</span>
                    ) : shot.snap ? (
                      [shot.snap.name, takenAgo(shot.snap.takenAt)].filter(Boolean).join(" · ")
                    ) : d.connected ? (
                      "Connected"
                    ) : (
                      "Start the agent on this Mac to see it"
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void shoot(d.agent_id)}
                  disabled={!d.connected || shot.busy}
                  aria-label={`Take a picture of ${name}`}
                  title="Take a picture"
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[var(--tb-accent)] text-[var(--tb-on-accent)] disabled:opacity-30"
                >
                  <Camera size={22} />
                </button>
              </figcaption>
            </figure>
          );
        })}
      </Carousel>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.name}
          className="fixed inset-0 z-50 flex flex-col bg-black"
          onKeyDown={(e) => e.key === "Escape" && setZoomed(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              {[zoomed.name, zoomed.snap.name, takenAgo(zoomed.snap.takenAt)].filter(Boolean).join(" · ")}
            </span>
            <button type="button" autoFocus onClick={() => setZoomed(null)} aria-label="Close" className="rounded-full p-2">
              <X size={22} />
            </button>
          </div>
          <img src={zoomed.snap.src} alt={`What ${zoomed.name} is showing`} className="min-h-0 flex-1 object-contain" />
        </div>
      )}
    </div>
  );
}
