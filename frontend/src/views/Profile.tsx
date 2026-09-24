/**
 * Who you are, what you can spend, and which screens are yours.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Link2, LogOut, Mic, MonitorOff, MonitorPlay, Trash2, X } from "lucide-react";
import { ProofRequiredError } from "@tollbooth-dpyc/web";
import { NostrProfilePanel, WalletCard, type Session } from "@tollbooth-dpyc/web/react";
import { forgetDisplay, getShortcut, listDisplays, pairDisplay, type Display } from "../lib/chart";
import { displayNames, normalizeCode, orderDisplays } from "../lib/screens";

const card = "rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-4";
const field =
  "rounded-lg border border-[var(--tb-line)] bg-transparent px-3 py-2.5 text-sm focus:border-[var(--tb-accent)] focus:outline-none";

export default function Profile({ session }: { session: Session }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <NostrProfilePanel npub={session.npub} />
      <WalletCard />
      <Displays />
      <Voice />
      <div className="flex items-center gap-3 px-1 pb-4">
        <span className="min-w-0 flex-1 text-[11px] text-[var(--tb-muted)]">
          {session.canSign ? "Signing with a key held in this tab." : "Signed in on a cached proof, which expires."}
        </span>
        <button
          type="button"
          onClick={session.signOut}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tb-line)] px-3 py-1.5 text-xs"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

function Displays() {
  const [displays, setDisplays] = useState<Display[] | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listDisplays()
      .then((d) => {
        setDisplays(orderDisplays(d));
        setError("");
      })
      .catch((e) => !(e instanceof ProofRequiredError) && setError((e as Error).message));
  }, []);

  useEffect(load, [load]);

  async function forget(agentId: string) {
    setBusy(agentId);
    setError("");
    try {
      await forgetDisplay(agentId);
      setConfirming(null);
      load();
    } catch (e) {
      if (!(e instanceof ProofRequiredError)) setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const names = displayNames(displays ?? []);

  return (
    <section className={card}>
      <h2 className="mb-3 text-sm text-[var(--tb-muted)]">Screens</h2>
      {displays?.length === 0 && <p className="text-sm text-[var(--tb-muted)]">None paired yet.</p>}
      <ul className="divide-y divide-[var(--tb-line)]">
        {displays?.map((d) => {
          const name = names.get(d.agent_id) ?? d.label;
          return (
            <li key={d.agent_id} className="flex items-center gap-3 py-2.5">
              {d.connected ? (
                <MonitorPlay size={18} className="text-[var(--tb-ok)]" aria-label="Connected" />
              ) : (
                <MonitorOff size={18} className="text-[var(--tb-muted)]" aria-label="Offline" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
              {confirming === d.agent_id ? (
                <>
                  <span className="text-xs text-[var(--tb-muted)]">Remove?</span>
                  <button
                    type="button"
                    onClick={() => void forget(d.agent_id)}
                    disabled={busy === d.agent_id}
                    aria-label={`Yes, remove ${name}`}
                    className="rounded-full p-2 text-[var(--tb-err-ink)] disabled:opacity-40"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    aria-label="Keep it"
                    className="rounded-full p-2 text-[var(--tb-muted)]"
                  >
                    <X size={18} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(d.agent_id)}
                  aria-label={`Remove ${name}`}
                  title="Remove"
                  className="rounded-full p-2 text-[var(--tb-muted)] hover:text-[var(--tb-err-ink)]"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-[var(--tb-err-ink)]">{error}</p>}
      <PairForm onPaired={load} />
    </section>
  );
}

function PairForm({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pair() {
    setBusy(true);
    setMsg(null);
    try {
      const d = await pairDisplay(code, label.trim() || "display");
      setMsg({ ok: true, text: `Paired ${d.label}. It shows as connected once its relay is running.` });
      setCode("");
      setLabel("");
      onPaired();
    } catch (e) {
      if (!(e instanceof ProofRequiredError)) setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[var(--tb-line)] pt-4">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <Link2 size={16} /> Pair a screen
      </div>
      <p className="mb-3 text-xs text-[var(--tb-muted)]">
        On that Mac, run <code className="font-mono">chartremotely pair</code> and type the code it shows.
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="CODE"
          aria-label="Pairing code"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${field} w-28 flex-none text-center font-mono tracking-widest`}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name, e.g. Desk"
          aria-label="Screen name"
          maxLength={40}
          className={`${field} min-w-0 flex-1`}
        />
      </div>
      <button
        type="button"
        onClick={() => void pair()}
        disabled={code.length !== 6 || busy}
        className="mt-3 w-full rounded-full bg-[var(--tb-accent)] py-2.5 text-sm font-medium text-[var(--tb-on-accent)] disabled:opacity-40"
      >
        {busy ? "Pairing…" : "Pair"}
      </button>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-[var(--tb-ok)]" : "text-[var(--tb-err-ink)]"}`}>{msg.text}</p>
      )}
    </div>
  );
}

function Voice() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    getShortcut()
      .then((s) => setUrl(s.url))
      .catch(() => setUrl(""));
  }, []);
  if (!url) return null;
  return (
    <a href={url} className={`${card} flex items-center gap-3 text-sm hover:border-[var(--tb-accent)]`}>
      <Mic size={18} className="text-[var(--tb-accent)]" />
      <span className="flex-1">Get the Siri Shortcut</span>
    </a>
  );
}
