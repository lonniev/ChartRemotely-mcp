/**
 * My Screens, browsed by symbol and then by capture.
 *
 * Every display keeps the newest few captures of each symbol it has shown,
 * for two hours. Here they are merged across the patron's displays: the top
 * carousel is one card per symbol, most recent first; under it, the chosen
 * symbol's captures, newest first, each labelled with the display that took
 * it.
 *
 * Viewing a picture is a paid request, so a picture is fetched only when its
 * slide has come to rest in view - never the set, never a slide swiped past -
 * and is kept for the visit once fetched. The status list that says what
 * exists is free, and is re-read while the page is looked at.
 *
 * Before anything is kept, ghosted example cards show the shape of the thing,
 * because nobody wants what they have never seen.
 */

const STATUS_EVERY_MS = 30_000;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, Plus, RotateCw, X } from "lucide-react";
import { ProofRequiredError, formatTime } from "@tollbooth-dpyc/web";
import { QuoteScroller, useTimezone } from "@tollbooth-dpyc/web/react";
import Carousel from "../components/Carousel";
import chartShot from "../assets/welcome/chart-ge.jpg";
import { listDisplays, takeCapture, takeSnapshot, type Display, type Snapshot } from "../lib/chart";
import {
  EXAMPLE_SYMBOLS,
  captureCount,
  groupBySymbol,
  indexOr0,
  type GalleryCapture,
  type SymbolGroup,
} from "../lib/gallery";
import { go } from "../lib/route";
import { CLOCK, displayNames, orderDisplays, takenAgo } from "../lib/screens";
import { pictureQuoteStyles, quoteStyles } from "../lib/quoteStyles";
import { TRADING_QUOTES } from "../lib/tradingQuotes";

interface Pic {
  snap?: Snapshot;
  busy?: boolean;
  error?: string;
}

interface Live {
  busy?: boolean;
  error?: string;
}

const SIRI_LINE = "Say “Hey Siri, ChartRemotely” and your charts gather here, by symbol, for two hours.";

export default function Screens() {
  const [displays, setDisplays] = useState<Display[] | null>(null);
  const [error, setError] = useState("");
  const [pics, setPics] = useState<Record<string, Pic>>({});
  // Read synchronously by view(), so one capture is never asked for twice.
  const picsRef = useRef(pics);
  picsRef.current = pics;
  const [live, setLive] = useState<Record<string, Live>>({});
  const [symbol, setSymbol] = useState<string | null>(null);
  const [capture, setCapture] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<{ title: string; snap: Snapshot } | null>(null);
  const [, tick] = useState(0);
  const [, zone] = useTimezone();

  const refresh = useCallback(
    () =>
      listDisplays()
        .then((d) => setDisplays(orderDisplays(d)))
        .catch((e) => {
          if (!(e instanceof ProofRequiredError)) throw e;
        }),
    [],
  );

  const load = useCallback(() => {
    setError("");
    refresh().catch((e) => setError((e as Error).message));
  }, [refresh]);

  useEffect(load, [load]);

  // The status list is free; re-read it while the page is being looked at, so
  // a chart changed by voice shows up here without a reload.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    }, STATUS_EVERY_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Keeps "4 min ago" honest without re-fetching anything.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const names = useMemo(() => displayNames(displays ?? []), [displays]);
  const groups = useMemo(() => groupBySymbol(displays ?? [], names), [displays, names]);
  const groupAt = indexOr0(groups, (g) => g.symbol === symbol);
  const group: SymbolGroup | undefined = groups[groupAt];
  const captureAt = group ? indexOr0(group.captures, (c) => c.id === capture) : 0;

  /** A kept capture's picture - once per visit, and only when asked for. */
  const view = useCallback(
    (c: GalleryCapture, retry = false) => {
      setCapture(c.id);
      const had = picsRef.current[c.id];
      if (had?.snap || had?.busy || (had?.error && !retry)) return;
      picsRef.current = { ...picsRef.current, [c.id]: { busy: true } };
      setPics((p) => ({ ...p, [c.id]: { busy: true } }));
      takeCapture(c.agentId, c.id)
        .then((snap) => setPics((p) => ({ ...p, [c.id]: { snap } })))
        .catch((e) => {
          if (e instanceof ProofRequiredError) return;
          setPics((p) => ({ ...p, [c.id]: { error: (e as Error).message } }));
        });
    },
    [],
  );

  /** A live picture: it lands as the newest capture of whatever is on screen. */
  async function shoot(d: Display) {
    setLive((l) => ({ ...l, [d.agent_id]: { busy: true } }));
    try {
      const snap = await takeSnapshot(d.agent_id);
      setLive((l) => ({ ...l, [d.agent_id]: {} }));
      if (!snap.capture) {
        // Shown, but not kept (the display could not seal it): look now or never.
        setZoomed({ title: names.get(d.agent_id) ?? d.label, snap });
        return;
      }
      picsRef.current = { ...picsRef.current, [snap.capture]: { snap } };
      setPics((p) => ({ ...p, [snap.capture!]: { snap } }));
      // The list first, then the choice: choosing a symbol the list does not
      // hold yet would centre some other capture, and fetch it.
      await refresh();
      setSymbol(snap.symbol ?? "-");
      setCapture(snap.capture);
    } catch (e) {
      if (e instanceof ProofRequiredError) return;
      setLive((l) => ({ ...l, [d.agent_id]: { error: (e as Error).message } }));
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
        <button type="button" onClick={load} className="min-h-10 rounded-full border border-[var(--tb-line)] px-4 py-2">
          Try again
        </button>
      </div>
    );
  }

  const paired = displays ?? [];

  return (
    <div className="mx-auto max-w-5xl pb-10 pt-4">
      {group ? (
        <>
          <Carousel
            label="Symbols"
            itemName="symbol"
            size="card"
            index={groupAt}
            onSettle={(i) => {
              const g = groups[i];
              if (!g || g.symbol === symbol) return;
              setSymbol(g.symbol);
              // Only a different symbol than the one shown starts again at its newest.
              if (g.symbol !== group.symbol) setCapture(null);
            }}
          >
            {groups.map((g) => (
              <SymbolCard key={g.symbol} group={g} selected={g.symbol === group.symbol} zone={zone} />
            ))}
          </Carousel>

          <div className="mt-2">
            <Carousel
              // A new symbol starts at its newest capture.
              key={group.symbol}
              label={`Captures of ${group.name}`}
              itemName="capture"
              index={captureAt}
              onSettle={(i) => {
                const c = group.captures[i];
                if (c) view(c);
              }}
            >
              {group.captures.map((c, i) => (
                <CaptureSlide
                  key={c.id}
                  capture={c}
                  pic={pics[c.id]}
                  inView={i === captureAt && capture === c.id}
                  zone={zone}
                  onOpen={(snap) => setZoomed({ title: `${group.name} · ${c.display}`, snap })}
                  onRetry={() => view(c, true)}
                />
              ))}
            </Carousel>
            {group.captures.length === 1 && (
              <p className="mt-1 text-center text-sm text-[var(--tb-muted)]">
                More captures of {group.name} collect here.
              </p>
            )}
          </div>
        </>
      ) : (
        <Examples zone={zone} />
      )}

      <DisplayRow displays={paired} names={names} live={live} onShoot={(d) => void shoot(d)} />

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.title}
          className="fixed inset-0 z-50 flex flex-col bg-black"
          onKeyDown={(e) => e.key === "Escape" && setZoomed(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{[zoomed.title, takenAgo(zoomed.snap.takenAt, zone)].filter(Boolean).join(" · ")}</span>
            <button
              type="button"
              autoFocus
              onClick={() => setZoomed(null)}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full"
            >
              <X size={22} />
            </button>
          </div>
          <img src={zoomed.snap.src} alt={zoomed.title} className="min-h-0 flex-1 object-contain" />
        </div>
      )}
    </div>
  );
}

function SymbolCard({ group, selected, zone }: { group: SymbolGroup; selected: boolean; zone: string }) {
  const shown = new Set(group.captures.map((c) => c.display));
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${group.name}, ${captureCount(group.captures.length)}`}
      className={`flex h-full min-h-28 w-full flex-col justify-between rounded-3xl border p-4 text-left transition-colors ${
        selected
          ? "border-[var(--tb-accent)] bg-[var(--tb-surface-2)]"
          : "border-[var(--tb-line)] bg-[var(--tb-surface)]"
      }`}
    >
      <span className="truncate font-mono text-2xl font-semibold tracking-tight">{group.name}</span>
      <span className="mt-3 text-xs text-[var(--tb-muted)]">
        <span className="block">
          {captureCount(group.captures.length)} · {formatTime(group.lastAt, zone, CLOCK)}
        </span>
        {shown.size > 1 && <span className="block truncate">{[...shown].join(" · ")}</span>}
      </span>
    </button>
  );
}

function CaptureSlide({
  capture,
  pic,
  inView,
  zone,
  onOpen,
  onRetry,
}: {
  capture: GalleryCapture;
  pic?: Pic;
  inView: boolean;
  zone: string;
  onOpen: (snap: Snapshot) => void;
  onRetry: () => void;
}) {
  const caption = [capture.display, formatTime(capture.taken_at, zone, CLOCK), capture.scale].filter(Boolean).join(" · ");
  const loading = pic?.busy || (inView && !pic);
  return (
    <figure className="m-0 overflow-hidden rounded-[28px] border border-[var(--tb-line)] bg-[var(--tb-surface)]">
      {/* A fixed-ratio box, so nothing moves when the picture arrives. */}
      <div className="relative aspect-[16/10] bg-black">
        {pic?.snap ? (
          <button
            type="button"
            onClick={() => onOpen(pic.snap!)}
            aria-label={`Open ${caption} full screen`}
            className="block h-full w-full"
          >
            <img src={pic.snap.src} alt={caption} className="h-full w-full object-contain" />
          </button>
        ) : pic?.error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm">
            <span className="text-[var(--tb-err-ink)]">{pic.error}</span>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--tb-line)] px-4"
            >
              <RotateCw size={16} /> Try again
            </button>
          </div>
        ) : loading ? (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black/85">
            <QuoteScroller quotes={TRADING_QUOTES} heading="Fetching your chart…" spinner classNames={pictureQuoteStyles} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--tb-muted)]">
            <ImageIcon size={36} aria-hidden="true" />
          </div>
        )}
      </div>
      <figcaption className="truncate px-5 py-3 text-sm text-[var(--tb-muted)]">{caption}</figcaption>
    </figure>
  );
}

function DisplayRow({
  displays,
  names,
  live,
  onShoot,
}: {
  displays: Display[];
  names: Map<string, string>;
  live: Record<string, Live>;
  onShoot: (d: Display) => void;
}) {
  if (!displays.length) {
    return (
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => go("profile")}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--tb-accent)] px-5 py-2.5 font-medium text-[var(--tb-on-accent)]"
        >
          <Plus size={18} /> Pair a screen
        </button>
      </div>
    );
  }
  const errors = displays.filter((d) => live[d.agent_id]?.error);
  return (
    <section aria-label="Your screens" className="mx-auto mt-8 max-w-3xl px-4">
      <div className="flex flex-wrap justify-center gap-2">
        {displays.map((d) => {
          const name = names.get(d.agent_id) ?? d.label;
          const busy = live[d.agent_id]?.busy;
          return (
            <div
              key={d.agent_id}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--tb-line)] bg-[var(--tb-surface)] py-1 pl-4 pr-1"
            >
              <span
                className={`h-2.5 w-2.5 flex-none rounded-full ${d.connected ? "bg-[var(--tb-ok)]" : "bg-[var(--tb-line)]"}`}
                title={d.connected ? "Connected" : "Offline"}
              />
              <span className="max-w-40 truncate text-sm">{name}</span>
              <button
                type="button"
                onClick={() => onShoot(d)}
                disabled={!d.connected || busy}
                aria-label={`Take a picture of ${name}`}
                title={d.connected ? "Take a picture" : "Offline"}
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--tb-accent)] text-[var(--tb-on-accent)] disabled:opacity-30"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              </button>
            </div>
          );
        })}
      </div>
      {errors.map((d) => (
        <p key={d.agent_id} className="mt-2 text-center text-sm text-[var(--tb-err-ink)]">
          {names.get(d.agent_id) ?? d.label}: {live[d.agent_id]!.error}
        </p>
      ))}
    </section>
  );
}

/**
 * What the page will hold, drawn before it holds anything: ghosted symbol
 * cards over ghosted captures. Dashed, faint and marked "Example", and not
 * controls - nothing here is data, and nothing here can be tapped.
 */
function Examples({ zone }: { zone: string }) {
  const clock = (minutesAgo: number) => formatTime(new Date(Date.now() - minutesAgo * 60_000).toISOString(), zone, CLOCK);
  const [lead] = EXAMPLE_SYMBOLS;
  const tag =
    "rounded-full border border-dashed border-[var(--tb-muted)]/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--tb-muted)]";
  const step = "px-4 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--tb-muted)]/80";
  return (
    <section aria-label="How this page fills up" className="select-none">
      <p className="mx-auto mb-6 mt-2 max-w-md px-6 text-center text-[17px] leading-relaxed">{SIRI_LINE}</p>

      {/* Laid out exactly as the real carousels are, so the example is the thing itself. */}
      <div aria-hidden="true" className="@container pointer-events-none">
        <p className={step}>By symbol</p>
        <div className="flex gap-3 overflow-hidden px-[30cqw] py-2 md:px-[39cqw]">
          {EXAMPLE_SYMBOLS.map((x, i) => (
            <div
              key={x.symbol}
              className={`flex min-h-28 w-[40cqw] flex-none flex-col justify-between rounded-3xl border-2 border-dashed p-4 md:w-[22cqw] ${
                i === 0 ? "border-[var(--tb-accent)]/45 opacity-75" : "scale-[0.92] border-[var(--tb-line)] opacity-45"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-2xl font-semibold tracking-tight text-[var(--tb-muted)]">{x.symbol}</span>
                <span className={tag}>Example</span>
              </div>
              <span className="mt-3 text-xs text-[var(--tb-muted)]">
                {captureCount(x.count)} · {clock(x.minutesAgo)}
              </span>
            </div>
          ))}
        </div>

        <p className={`${step} mt-4`}>Then by capture</p>
        <div className="flex gap-3 overflow-hidden px-[9cqw] py-2 md:px-[19cqw]">
          {[0, 1].map((n) => (
            <figure
              key={n}
              className={`m-0 w-[82cqw] flex-none overflow-hidden rounded-[28px] border-2 border-dashed md:w-[62cqw] ${
                n === 0 ? "border-[var(--tb-accent)]/40" : "scale-[0.92] border-[var(--tb-line)] opacity-50"
              }`}
            >
              <div className="relative aspect-[16/10] bg-black">
                <img src={chartShot} alt="" className="h-full w-full object-contain opacity-20 grayscale" />
                <span className={`absolute left-3 top-3 bg-black/60 ${tag}`}>Example capture</span>
              </div>
              <figcaption className="px-5 py-3 text-sm text-[var(--tb-muted)] opacity-80">
                {lead.symbol} · Your Mac · {clock(lead.minutesAgo + n * 9)}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
