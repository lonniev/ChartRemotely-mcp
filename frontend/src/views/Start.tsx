/**
 * Get started: everything a newcomer needs, before any sign-in.
 *
 * Setup runs on the Mac, where the agent lives. The page offers it two ways —
 * a one-click Setup Shortcut, and the Terminal command that Shortcut runs, shown
 * in full so anyone can read exactly what it does.
 */

import { useState } from "react";
import { Check, Copy, Download, Laptop, Monitor, Network, Smartphone } from "lucide-react";
import { go } from "../lib/route";

const COMMAND = "curl -fsSL https://chartremotely.tollbooth-dpyc.com/install.sh | sh";
const SETUP_SHORTCUT = `/ChartRemotely-Setup.shortcut?v=${__SETUP_SHORTCUT_VERSION__}`;

const NEEDS = [
  { icon: Laptop, text: "A Mac running thinkorswim — the Mac that drives your display." },
  { icon: Network, text: "Tailscale on that Mac and on your other devices." },
  { icon: Smartphone, text: "An iPhone, iPad or Apple Watch for voice commands." },
];

const STEPS = [
  "Identity. Use your existing Nostr npub, proven by replying to one Nostr direct message, or create a new key. A new key is saved to this Mac's Keychain for you.",
  "Checks. Confirms thinkorswim is running and that the agent holds macOS Accessibility and Screen Recording permission, and that Tailscale is signed in.",
  "Pairing. Pairs this Mac to your npub, so the display appears in your account.",
  "Services. Installs the two background services: the listener your Shortcut calls, and the connection the website and agents use.",
  "Siri Shortcut. Builds your personal ChartRemotely Shortcut with this Mac's address already in it, ready to sync to your iPhone, iPad and Apple Watch.",
];

export default function Start() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(COMMAND).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Get started</h1>
      <p className="mt-3 max-w-2xl text-[var(--tb-muted)]">
        Setup runs once, on the Mac that drives your thinkorswim display. It takes a few minutes and guides you through
        each step.
      </p>

      <section aria-labelledby="needs" className="mt-8">
        <h2 id="needs" className="mb-3 text-sm uppercase tracking-wider text-[var(--tb-muted)]">
          What you need
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {NEEDS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-4 text-sm">
              <Icon size={20} className="flex-none text-[var(--tb-accent)]" aria-hidden="true" />
              <span className="text-[var(--tb-muted)]">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="run" className="mt-10 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-6">
        <h2 id="run" className="font-medium">Run setup on your Mac</h2>
        <a
          href={SETUP_SHORTCUT}
          download="ChartRemotely Setup.shortcut"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--tb-accent)] px-6 py-3 font-medium text-[var(--tb-on-accent)]"
        >
          <Download size={18} aria-hidden="true" /> Download ChartRemotely Setup
        </a>
        <p className="mt-3 text-sm text-[var(--tb-muted)]">
          Open the downloaded Shortcut on your Mac. It opens Terminal and runs this command, which you may also paste into
          Terminal yourself:
        </p>
        <div className="mt-3 flex items-stretch gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[#0b0d10] px-3 py-2.5 font-mono text-xs leading-relaxed ring-1 ring-[var(--tb-line)]">
            {COMMAND}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy the command"
            className="flex-none rounded-lg px-3 ring-1 ring-[var(--tb-line)] text-[var(--tb-muted)]"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--tb-muted)]">
          The command installs the open-source{" "}
          <a href="https://github.com/lonniev/ChartRemotely-agent" className="underline">ChartRemotely agent</a> from PyPI
          and starts its guided setup. Read the script first at{" "}
          <a href="/install.sh" className="underline">/install.sh</a>.
        </p>
      </section>

      <section aria-labelledby="does" className="mt-10">
        <h2 id="does" className="mb-3 text-sm uppercase tracking-wider text-[var(--tb-muted)]">
          What setup does
        </h2>
        <ol className="space-y-3">
          {STEPS.map((text, i) => {
            const [head, ...rest] = text.split(". ");
            return (
              <li key={head} className="flex gap-4 rounded-2xl border border-[var(--tb-line)] p-4 text-sm">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--tb-surface-2)] text-xs text-[var(--tb-accent)]">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium">{head}.</span>{" "}
                  <span className="text-[var(--tb-muted)]">{rest.join(". ")}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="mt-8 flex items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <Monitor size={20} className="flex-none text-[var(--tb-accent)]" aria-hidden="true" />
        Your phone, tablet and watch carry only the Shortcut. Your Nostr key stays with you, in your Keychain; the
        Shortcut speaks to your Mac over your private Tailscale network.
      </p>

      <div className="mt-10 flex flex-wrap gap-5 text-sm">
        <button type="button" onClick={() => go("how")} className="text-[var(--tb-accent)]">
          How it works →
        </button>
        <button type="button" onClick={() => go("signin")} className="text-[var(--tb-accent)]">
          Already set up? Sign in →
        </button>
      </div>
    </div>
  );
}
