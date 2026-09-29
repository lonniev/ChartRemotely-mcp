/**
 * My Screens, browsed by symbol and then by capture.
 *
 * Every display keeps the newest few captures of each symbol it has shown,
 * for four hours. Here they are merged across the patron's displays: the top
 * carousel is one card per symbol, most recent first; under it, the chosen
 * symbol's captures, newest first, each labelled with the display that took
 * it. Opened full screen, a picture sits in one long carousel of every kept
 * capture - swipe on past a symbol's oldest and the next symbol's newest is
 * there - and the page beneath follows, so closing lands where the eye left.
 *
 * Viewing a picture is a paid request, so a picture is fetched only when its
 * slide has come to rest in view - never the set, never a slide swiped past -
 * and is kept for the visit once fetched, whichever carousel asks. The status
 * list that says what exists is free, and is re-read while the page is looked
 * at.
 *
 * Before anything is kept, ghosted example cards show the shape of the thing,
 * because nobody wants what they have never seen.
 */

const STATUS_EVERY_MS = 30_000;

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Camera, ImageIcon, Loader2, Plus, RotateCw, X } from "lucide-react";
import { ProofRequiredError, formatTime } from "@tollbooth-dpyc/web";
import { QuoteScroller, useTimezone } from "@tollbooth-dpyc/web/react";
import Carousel from "../components/Carousel";
import chartShot from "../assets/welcome/chart-ge.jpg";
import { listDisplays, takeCapture, takeSnapshot, type Display, type Snapshot } from "../lib/chart";
import {
  EXAMPLE_SYMBOLS,
  captureCount,
  flattenCaptures,
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

type Zoomed =
  /** The kept captures, full screen; which one is the page's ``capture``. */
  | { kind: "kept" }
  /** A live picture the display could not keep: look now or never. */
  | { kind: "live"; title: string; snap: Snapshot };

const SIRI_LINE = "Say “Hey Siri, ChartRemotely” and your charts gather here, by symbol, for four hours.";

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
  const [zoomed, setZoomed] = useState<Zoomed | null>(null);
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
  const flat = useMemo(() => flattenCaptures(groups), [groups]);
  const flatAt = indexOr0(flat, (f) => f.id === capture);
  const current = flat[flatAt];

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
        setZoomed({ kind: "live", title: names.get(d.agent_id) ?? d.label, snap });
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
                  onOpen={() => {
                    setCapture(c.id);
                    setZoomed({ kind: "kept" });
                  }}
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

      {zoomed?.kind === "kept" && current && (
        <Lightbox
          title={`${current.name} · ${captionOf(current, zone)}`}
          count={`${flatAt + 1} of ${flat.length}`}
          onClose={() => setZoomed(null)}
        >
          <Carousel
            label="Every capture, full screen"
            itemName="capture"
            size="full"
            dots={false}
            autoFocus
            index={flatAt}
            onSettle={(i) => {
              const f = flat[i];
              if (!f) return;
              // The page beneath follows: its symbol, then (through view) its capture.
              setSymbol(f.symbol);
              view(f);
            }}
          >
            {flat.map((f, i) => (
              <div key={f.id} className="relative h-full bg-black">
                <Picture
                  pic={pics[f.id]}
                  loading={i === flatAt && capture === f.id}
                  alt={`${f.name} · ${captionOf(f, zone)}`}
                  onRetry={() => view(f, true)}
                />
              </div>
            ))}
          </Carousel>
        </Lightbox>
      )}

      {zoomed?.kind === "live" && (
        <Lightbox
          title={[zoomed.title, takenAgo(zoomed.snap.takenAt, zone)].filter(Boolean).join(" · ")}
          onClose={() => setZoomed(null)}
          closeFocus
        >
          <img src={zoomed.snap.src} alt={zoomed.title} className="h-full w-full object-contain" />
        </Lightbox>
      )}
    </div>
  );
}

/** How a capture is captioned everywhere: display, time, scale - whatever is known. */
function captionOf(c: GalleryCapture, zone: string): string {
  return [c.display, formatTime(c.taken_at, zone, CLOCK), c.scale].filter(Boolean).join(" · ");
}

/**
 * The full-screen frame: a title line, an optional count, a close button, and
 * whatever fills the rest. Escape closes it from anywhere inside.
 */
function Lightbox({
  title,
  count,
  onClose,
  closeFocus = false,
  children,
}: {
  title: string;
  count?: string;
  onClose: () => void;
  /** Focus the close button rather than the content (a lone picture). */
  closeFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-center gap-3 px-4 py-3 text-sm">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {count && <span className="flex-none text-[var(--tb-muted)]">{count}</span>}
        <button
          type="button"
          autoFocus={closeFocus}
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
        >
          <X size={22} />
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
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
  onOpen: () => void;
  onRetry: () => void;
}) {
  const caption = captionOf(capture, zone);
  return (
    <figure className="m-0 overflow-hidden rounded-[28px] border border-[var(--tb-line)] bg-[var(--tb-surface)]">
      {/* A fixed-ratio box, so nothing moves when the picture arrives. */}
      <div className="relative aspect-[16/10] bg-black">
        <Picture pic={pic} loading={inView} alt={caption} onOpen={onOpen} onRetry={onRetry} />
      </div>
      <figcaption className="truncate px-5 py-3 text-sm text-[var(--tb-muted)]">{caption}</figcaption>
    </figure>
  );
}

/**
 * One capture's picture in whatever state it is in: shown (and, given
 * ``onOpen``, a button that opens it full screen), failed with a retry, being
 * fetched, or - when ``loading`` says its turn has not come - an empty frame.
 * Fills the box it is given.
 */
function Picture({
  pic,
  loading,
  alt,
  onOpen,
  onRetry,
}: {
  pic?: Pic;
  /** This slide is the one in view, so a fetch is coming even before it starts. */
  loading: boolean;
  alt: string;
  onOpen?: () => void;
  onRetry: () => void;
}) {
  if (pic?.snap) {
    const img = <img src={pic.snap.src} alt={alt} className="h-full w-full object-contain" />;
    return onOpen ? (
      <button type="button" onClick={onOpen} aria-label={`Open ${alt} full screen`} className="block h-full w-full">
        {img}
      </button>
    ) : (
      img
    );
  }
  if (pic?.error) {
    return (
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
    );
  }
  if (pic?.busy || loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black/85">
        <QuoteScroller quotes={TRADING_QUOTES} heading="Fetching your chart…" spinner classNames={pictureQuoteStyles} />
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center text-[var(--tb-muted)]">
      <ImageIcon size={36} aria-hidden="true" />
    </div>
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
