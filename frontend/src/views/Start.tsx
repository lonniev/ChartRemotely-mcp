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
import { useT, WORDS } from "../i18n";
import { Tx } from "@tollbooth-dpyc/web/react";

const COMMAND = "curl -fsSL https://chartremotely.tollbooth-dpyc.com/install.sh | sh";
const SETUP_SHORTCUT = `/ChartRemotely-Setup.shortcut?v=${__SETUP_SHORTCUT_VERSION__}`;

const NEEDS = [
  { icon: Laptop, id: "mac" },
  { icon: Network, id: "tailscale" },
  { icon: Smartphone, id: "device" },
] as const;

const STEPS = ["identity", "checks", "pairing", "services", "siri"] as const;

export default function Start() {
  const t = useT();
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
    <div className="mx-auto max-w-[90rem] px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("views.start.title")}</h1>
      <p className="mt-3 text-[var(--tb-muted)]">
        {t("views.start.lede")}
      </p>

      <section aria-labelledby="needs" className="mt-8">
        <h2 id="needs" className="mb-3 text-sm uppercase tracking-wider text-[var(--tb-muted)]">
          {t("views.start.needs.heading")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {NEEDS.map(({ icon: Icon, id }) => (
            <li key={id} className="flex gap-3 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-4 text-sm">
              <Icon size={20} className="flex-none text-[var(--tb-accent)]" aria-hidden="true" />
              <span className="text-[var(--tb-muted)]">{t(`views.start.needs.${id}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="run" className="mt-10 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-6">
        <h2 id="run" className="font-medium">{t("views.start.run.heading")}</h2>
        <a
          href={SETUP_SHORTCUT}
          download="ChartRemotely Setup.shortcut"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--tb-accent)] px-6 py-3 font-medium text-[var(--tb-on-accent)]"
        >
          <Download size={18} aria-hidden="true" /> {t("views.start.run.download")}
        </a>
        <p className="mt-3 text-sm text-[var(--tb-muted)]">
          {t("views.start.run.explain")}
        </p>
        <div className="mt-3 flex items-stretch gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[#0b0d10] px-3 py-2.5 font-mono text-xs leading-relaxed ring-1 ring-[var(--tb-line)]">
            {COMMAND}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label={t("views.start.run.copy")}
            className="flex-none rounded-lg px-3 ring-1 ring-[var(--tb-line)] text-[var(--tb-muted)]"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--tb-muted)]">
          <Tx ns={WORDS} k="views.start.run.source" components={{
            agent: <a href="https://github.com/lonniev/ChartRemotely-agent" className="underline" />,
            script: <a href="/install.sh" className="underline" />,
          }} />
        </p>
      </section>

      <section aria-labelledby="does" className="mt-10">
        <h2 id="does" className="mb-3 text-sm uppercase tracking-wider text-[var(--tb-muted)]">
          {t("views.start.does.heading")}
        </h2>
        <ol className="space-y-3">
          {STEPS.map((id, i) => {
            return (
              <li key={id} className="flex gap-4 rounded-2xl border border-[var(--tb-line)] p-4 text-sm">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--tb-surface-2)] text-xs text-[var(--tb-accent)]">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium">{t(`views.start.step.${id}.head`)}</span>{" "}
                  <span className="text-[var(--tb-muted)]">{t(`views.start.step.${id}.says`)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="mt-8 flex items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <Monitor size={20} className="flex-none text-[var(--tb-accent)]" aria-hidden="true" />
        {t("views.start.safe")}
      </p>

      <div className="mt-10 flex flex-wrap gap-5 text-sm">
        <button type="button" onClick={() => go("how")} className="text-[var(--tb-accent)]">
          {t("views.start.how")}
        </button>
        <button type="button" onClick={() => go("signin")} className="text-[var(--tb-accent)]">
          {t("views.start.signIn")}
        </button>
      </div>
    </div>
  );
}
