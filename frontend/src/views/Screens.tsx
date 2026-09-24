/**
 * Every paired screen, one slide each, and a picture of it on request.
 *
 * Nothing refreshes by itself: every picture is a paid request, so a picture is
 * taken only when the patron taps for one. Pictures are kept for this visit
 * only — the service stores none.
 */

import { useCallback, useEffect, useState } from "react";
import { Camera, Loader2, MonitorOff, MonitorPlay, Plus, X } from "lucide-react";
import { ProofRequiredError } from "@tollbooth-dpyc/web";
import Carousel from "../components/Carousel";
import { listDisplays, takeSnapshot, type Display, type Snapshot } from "../lib/chart";
import { go } from "../lib/route";
import { displayNames, orderDisplays, takenAgo } from "../lib/screens";

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

  // Keeps "4 min ago" honest without re-fetching anything.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function shoot(agentId: string) {
    setShots((s) => ({ ...s, [agentId]: { ...s[agentId], busy: true, error: undefined } }));
    try {
      const snap = await takeSnapshot(agentId);
      setShots((s) => ({ ...s, [agentId]: { snap } }));
    } catch (e) {
      if (e instanceof ProofRequiredError) return;
      setShots((s) => ({ ...s, [agentId]: { ...s[agentId], busy: false, error: (e as Error).message } }));
    }
  }

  if (displays === null && !error) {
    return (
      <div className="flex justify-center py-24 text-[var(--tb-muted)]">
        <Loader2 className="animate-spin" />
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
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--tb-muted)]">
                    {d.connected ? <MonitorPlay size={44} /> : <MonitorOff size={44} />}
                    <span className="text-sm">{d.connected ? "Tap the camera to look" : "Offline"}</span>
                  </div>
                )}
                {shot.busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="animate-spin" size={32} />
                  </div>
                )}
              </div>

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
                      takenAgo(shot.snap.takenAt)
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
              {zoomed.name} · {takenAgo(zoomed.snap.takenAt)}
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
