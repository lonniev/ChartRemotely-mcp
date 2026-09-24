/**
 * How the pieces fit, shown rather than told: real devices and the services'
 * own marks, joined by the connections that actually run between them.
 *
 * Photos are freely licensed from Wikimedia Commons and credited below; logos
 * come from Simple Icons (CC0) and only identify the service beside them.
 */

import { Bot, Globe, KeyRound, Lock, SlidersHorizontal, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { go } from "../lib/route";

const IMG = "/how";

/**
 * A real object: a photo in a rounded frame, with its name and one line.
 * Every device frame shares one height, so phone, tablet and watch line up.
 */
function Photo({ src, alt, name, line, width = "w-28" }: {
  src: string; alt: string; name: string; line: string; width?: string;
}) {
  return (
    <figure className={`flex flex-none flex-col items-center text-center ${width}`}>
      <div className="h-36 w-full overflow-hidden rounded-2xl bg-[var(--tb-surface-2)] ring-1 ring-[var(--tb-line)] sm:h-40">
        <img src={`${IMG}/${src}`} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <figcaption className="mt-2 text-sm font-medium">{name}</figcaption>
      <div className="text-xs leading-snug text-[var(--tb-muted)]">{line}</div>
    </figure>
  );
}

/** A service: its mark on a tile, with its name and one line. */
function Service({ logo, icon: Icon, name, line }: {
  logo?: string; icon?: LucideIcon; name: string; line: string;
}) {
  return (
    <figure className="flex w-28 flex-none flex-col items-center text-center sm:w-32">
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-[var(--tb-surface)] ring-1 ring-[var(--tb-line)]">
        {logo ? (
          <img src={`${IMG}/logos/${logo}.svg`} alt="" className="h-12 w-12 invert" />
        ) : Icon ? (
          <Icon size={44} className="text-[var(--tb-accent)]" aria-hidden="true" />
        ) : null}
      </div>
      <figcaption className="mt-2 text-sm font-medium">{name}</figcaption>
      <div className="text-xs leading-snug text-[var(--tb-muted)]">{line}</div>
    </figure>
  );
}

/**
 * A live connection: a glowing line with what travels along it. Down the page
 * on a phone, across it on a wide screen; ``down`` keeps it vertical always.
 */
function Wire({ label, down = false }: { label: string; down?: boolean }) {
  const box = down ? "my-3 h-20 flex-col" : "h-16 flex-col lg:h-auto lg:w-24";
  const line = down ? "h-8 w-[3px]" : "h-8 w-[3px] lg:h-[3px] lg:w-full";
  return (
    <div className={`flex flex-none items-center justify-center gap-2 text-center text-[11px] text-[var(--tb-muted)] ${box}`}>
      <span aria-hidden="true" className={`wire block rounded-full ${line}`} />
      <span className="max-w-28 leading-tight">{label}</span>
    </div>
  );
}

/** The chart monitor: a bezel around a real trading-screen photo. */
function Monitor() {
  return (
    <figure className="flex w-40 flex-none flex-col items-center text-center sm:w-48">
      <div className="w-full rounded-xl bg-[#1b1f24] p-1.5 shadow-[0_0_40px_-10px_var(--tb-accent)] ring-1 ring-[#2a3038]">
        <div className="aspect-[16/10] overflow-hidden rounded-md">
          <img src={`${IMG}/chart.jpg`} alt="A trading chart on a monitor" loading="lazy" className="h-full w-full object-cover" />
        </div>
      </div>
      <div className="mx-auto h-3 w-8 bg-[#2a3038]" aria-hidden="true" />
      <div className="mx-auto h-1.5 w-16 rounded-full bg-[#2a3038]" aria-hidden="true" />
      <figcaption className="mt-2 text-sm font-medium">thinkorswim</figcaption>
      <div className="text-xs leading-snug text-[var(--tb-muted)]">the chart on your wall</div>
    </figure>
  );
}

function Band({ children, title, logo }: { children: ReactNode; title: string; logo?: string }) {
  return (
    <div className="relative rounded-3xl border border-dashed border-[var(--tb-accent)]/50 bg-[var(--tb-accent)]/[0.04] p-5 pt-8">
      <div className="absolute -top-3.5 left-5 flex items-center gap-2 rounded-full bg-[#0b0d10] px-3 py-1 text-xs font-medium text-[var(--tb-accent)] ring-1 ring-[var(--tb-accent)]/50">
        {logo && <img src={`${IMG}/logos/${logo}.svg`} alt="" className="h-3.5 w-3.5 invert" />}
        {title}
      </div>
      {children}
    </div>
  );
}

const CREDITS = [
  { what: "iPhone", title: "Apple iPhone 15 Pro", by: "IPHONE 15", license: "CC BY-SA 4.0",
    page: "https://commons.wikimedia.org/wiki/File:Apple_iPhone_15_Pro.jpg", cropped: true },
  { what: "iPad", title: "SAKURAKO - iPad Pro.", by: "MIKI Yoshihito", license: "CC BY 2.0",
    page: "https://commons.wikimedia.org/wiki/File:SAKURAKO_-_iPad_Pro._(41019504540).jpg", cropped: false },
  { what: "Apple Watch", title: "Apple Watch Series 7; January 2022 (01)", by: "MIKI Yoshihito", license: "CC BY 2.0",
    page: "https://commons.wikimedia.org/wiki/File:Apple_Watch_Series_7;_January_2022_(01).jpg", cropped: true },
  { what: "Mac mini", title: "Mac mini M4 2024-11-16 1", by: "Yelderberry", license: "CC BY-SA 4.0",
    page: "https://commons.wikimedia.org/wiki/File:Mac_mini_M4_2024-11-16_1.jpg", cropped: true },
  { what: "Chart screen", title: "Stock market charts illustration", by: "unknown author", license: "CC0",
    page: "https://commons.wikimedia.org/wiki/File:Stock_market_charts_illustration.jpg", cropped: false },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <style>{`
        .wire {
          background: linear-gradient(90deg, transparent, var(--tb-accent), transparent);
          background-size: 200% 100%;
          box-shadow: 0 0 12px var(--tb-accent);
          animation: wire 2.4s linear infinite;
        }
        @keyframes wire { from { background-position: 100% 0 } to { background-position: -100% 0 } }
        @media (prefers-reduced-motion: reduce) { .wire { animation: none } }
      `}</style>

      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 max-w-xl text-[var(--tb-muted)]">
        Your voice reaches your Mac over your own tailnet. Everything else meets in the cloud, and your Mac dials out to
        it.
      </p>

      <section aria-label="By voice" className="mt-10">
        <Band title="Your tailnet" logo="tailscale">
          <div className="flex flex-col items-center gap-2 lg:flex-row lg:justify-center">
            <div className="flex gap-3">
              <Photo src="iphone.jpg" alt="An iPhone" name="iPhone" line="“Hey Siri, ChartRemotely”" width="w-20 sm:w-24" />
              <Photo src="ipad.jpg" alt="An iPad in someone's hands" name="iPad" line="same Shortcut" width="w-36 sm:w-44" />
              <Photo src="watch.jpg" alt="An Apple Watch" name="Watch" line="from your wrist" width="w-20 sm:w-24" />
            </div>
            <Wire label="HTTPS, private to your tailnet" />
            <Photo src="mac-mini.jpg" alt="A Mac mini" name="Your Mac" line="the agent, behind Tailscale Serve" width="w-36 sm:w-44" />
            <Wire label="keystrokes into the chart" />
            <Monitor />
          </div>
        </Band>
      </section>

      <div className="flex justify-center">
        <Wire label="your Mac dials out: commands down, pictures up" down />
      </div>

      <section aria-label="From anywhere">
        <Band title="The cloud">
          <div className="flex flex-col items-center gap-2 lg:flex-row lg:justify-center">
            <div className="flex gap-3">
              <Service icon={Globe} name="This site" line="sign in, look, tap" />
              <Service icon={Bot} name="Your agent" line="any MCP client" />
            </div>
            <Wire label="MCP over HTTPS" />
            <Service logo="cloudflare" name="Cloudflare" line="Pages + the /mcp proxy" />
            <Wire label="to the operator" />
            <Service logo="prefect" name="Prefect Horizon" line="the ChartRemotely MCP" />
            <Wire label="pairings, queue, pictures" />
            <Service logo="neon" name="Neon" line="Postgres; pictures encrypted, one hour" />
          </div>
        </Band>
      </section>

      <section aria-label="Tollbooth DPYC" className="mt-8">
        <Band title="Tollbooth DPYC">
          <div className="flex flex-wrap justify-center gap-4">
            <Service icon={KeyRound} name="Nostr" line="your npub is your sign-in" />
            <Service logo="bitcoin" name="Bitcoin" line="a prepaid balance in sats" />
            <Service icon={Zap} name="Lightning" line="top up in seconds" />
            <Service icon={SlidersHorizontal} name="Pricing Studio" line="the operator prices every tool live" />
          </div>
        </Band>
      </section>

      <p className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <Lock className="flex-none text-[var(--tb-accent)]" size={20} aria-hidden="true" />
        Your Mac opens no ports: it reaches out to the cloud, and your voice stays inside your tailnet. Pictures show the
        chart pane alone.
      </p>

      <div className="mt-8 text-center">
        <button type="button" onClick={() => go("welcome")} className="text-sm text-[var(--tb-accent)]">
          ← Back to the start
        </button>
      </div>

      <footer className="mt-12 border-t border-[var(--tb-line)] pt-6 text-[11px] leading-relaxed text-[var(--tb-muted)]">
        <div className="mb-1">Photos from Wikimedia Commons:</div>
        <ul className="space-y-0.5">
          {CREDITS.map((c) => (
            <li key={c.what}>
              {c.what}: <a href={c.page} className="underline">{c.title}</a> by {c.by}, {c.license}
              {c.cropped ? ", cropped" : ""}.
            </li>
          ))}
        </ul>
        <div className="mt-2">
          Logos from <a href="https://simpleicons.org" className="underline">Simple Icons</a> (CC0); each mark belongs to
          its owner.
        </div>
      </footer>
    </div>
  );
}
