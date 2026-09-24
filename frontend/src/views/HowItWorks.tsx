/**
 * How the pieces fit, shown rather than told: real devices and the services'
 * own marks, joined by the connections that actually run between them.
 *
 * Photos are freely licensed from Wikimedia Commons and credited below; logos
 * come from Simple Icons (CC0) and only identify the service beside them.
 */

import {
  Bot,
  CandlestickChart,
  Globe,
  Home,
  Hotel,
  KeyRound,
  Landmark,
  Lock,
  SlidersHorizontal,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { go } from "../lib/route";

const IMG = "/how";

/** Where a device's screen sits in its photo, as percentages of the photo. */
interface Screen { src: string; left: number; top: number; width: number; height: number; radius: number }

/**
 * A real object: a photo in a rounded frame, with its name and one line.
 * Every device frame shares one height, so phone, tablet and watch line up.
 * A ``screen`` lays a chart over the device's own display, which is why that
 * photo is shown whole (its aspect kept) rather than cropped to the frame.
 */
function Photo({ src, alt, name, line, width = "w-28", screen, aspect }: {
  src: string; alt: string; name: string; line: string; width?: string; screen?: Screen; aspect?: string;
}) {
  return (
    <figure className={`flex flex-none flex-col items-center text-center ${width}`}>
      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl bg-[var(--tb-surface-2)] ring-1 ring-[var(--tb-line)] sm:h-36">
        <div className={`relative h-full ${aspect ?? "w-full"}`}>
          <img src={`${IMG}/${src}`} alt={alt} loading="lazy" className="h-full w-full object-cover" />
          {screen && (
            <img
              src={`${IMG}/${screen.src}`}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute object-cover"
              style={{
                left: `${screen.left}%`, top: `${screen.top}%`,
                width: `${screen.width}%`, height: `${screen.height}%`,
                borderRadius: `${screen.radius}%`,
              }}
            />
          )}
        </div>
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
    <figure className="flex w-28 flex-none flex-col items-center text-center sm:w-32 lg:w-28">
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
  const box = down ? "my-3 h-20 flex-col" : "h-16 flex-col lg:h-auto lg:w-16 xl:w-20";
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
    <figure className="flex w-40 flex-none flex-col items-center text-center sm:w-44">
      <div className="w-full rounded-xl bg-[#1b1f24] p-1.5 shadow-[0_0_40px_-10px_var(--tb-accent)] ring-1 ring-[#2a3038]">
        <div className="aspect-[16/10] overflow-hidden rounded-md">
          <img src={`${IMG}/chart.jpg`} alt="A trading chart on a monitor" loading="lazy" className="h-full w-full object-cover" />
        </div>
      </div>
      <div className="mx-auto h-3 w-8 bg-[#2a3038]" aria-hidden="true" />
      <div className="mx-auto h-1.5 w-16 rounded-full bg-[#2a3038]" aria-hidden="true" />
      <figcaption className="mt-2 text-sm font-medium">thinkorswim</figcaption>
      <div className="text-xs leading-snug text-[var(--tb-muted)]">the charting display</div>
    </figure>
  );
}

/** A dashed band: one network, or one layer of the system, with its label chip. */
function Band({ children, title, logo, subtitle }: {
  children: ReactNode; title: string; logo?: string; subtitle?: string;
}) {
  return (
    <div className="relative rounded-3xl border border-dashed border-[var(--tb-accent)]/50 bg-[var(--tb-accent)]/[0.04] p-5 pt-9">
      <div className="absolute -top-3.5 left-5 flex items-center gap-2 rounded-full bg-[#0b0d10] px-3 py-1 text-xs font-medium text-[var(--tb-accent)] ring-1 ring-[var(--tb-accent)]/50">
        {logo && <img src={`${IMG}/logos/${logo}.svg`} alt="" className="h-3.5 w-3.5 invert" />}
        {title}
      </div>
      {subtitle && <p className="mb-4 text-center text-xs text-[var(--tb-muted)]">{subtitle}</p>}
      {children}
    </div>
  );
}

/** A physical network inside the tailnet: a home LAN, a hotel LAN. */
function Lan({ icon: Icon, name, children }: { icon: LucideIcon; name: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--tb-line)] bg-[#0b0d10]/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--tb-muted)]">
        <Icon size={14} aria-hidden="true" /> {name}
      </div>
      {children}
    </div>
  );
}

const CREDITS = [
  { what: "iPhone", title: "Apple iPhone 15 Pro", by: "IPHONE 15", license: "CC BY-SA 4.0",
    page: "https://commons.wikimedia.org/wiki/File:Apple_iPhone_15_Pro.jpg", cropped: true },
  { what: "iPad", title: "IPad Air 11-inch (M2) front side", by: "茅野ふたば", license: "CC BY-SA 4.0",
    page: "https://commons.wikimedia.org/wiki/File:IPad_Air_11-inch_(M2)_front_side_(20250525_154539).jpg",
    cropped: false, note: "screen replaced with the chart photograph" },
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
      <p className="mt-3 max-w-2xl text-[var(--tb-muted)]">
        Voice commands travel over a private Tailscale network that joins every location you work from. Browser and
        agent requests meet in the cloud, where your Mac collects them over its own outbound connection.
      </p>

      <section aria-label="Your tailnet" className="mt-10">
        <Band title="Your tailnet" logo="tailscale" subtitle="One private network across every location">
          <div className="flex flex-col items-center">
            <Lan icon={Home} name="Home network">
              <div className="flex flex-col items-center gap-2 lg:flex-row">
                <div className="flex gap-3">
                  <Photo src="iphone.jpg" alt="An iPhone" name="iPhone" line="Siri Shortcut" width="w-20" />
                  <Photo src="watch.jpg" alt="An Apple Watch" name="Apple Watch" line="Siri Shortcut" width="w-20" />
                </div>
                <Wire label="HTTPS within the tailnet" />
                <Photo src="mac-mini.jpg" alt="A Mac mini" name="Mac mini" line="ChartRemotely agent, behind Tailscale Serve" width="w-36" />
                <Wire label="Accessibility keystrokes" />
                <Monitor />
              </div>
            </Lan>
            <Wire label="Tailscale joins both networks into one private tailnet" down />
            <Lan icon={Hotel} name="Hotel network">
              <div className="flex justify-center">
                <Photo
                  src="ipad.jpg"
                  alt="An iPad showing a trading chart"
                  name="iPad"
                  line="Siri Shortcut, on the hotel's Wi-Fi"
                  width="w-48 sm:w-52"
                  aspect="aspect-[4/3]"
                  screen={{ src: "chart.jpg", left: 10.4, top: 12.3, width: 81.8, height: 75.7, radius: 2.5 }}
                />
              </div>
            </Lan>
          </div>
        </Band>
      </section>

      <section aria-label="Live market data" className="mt-8">
        <Band title="Live market data">
          <div className="flex flex-col items-center gap-2 lg:flex-row lg:justify-center">
            <Service icon={TrendingUp} name="thinkorswim" line="the trading and charting platform" />
            <Wire label="live quotes and chart data" />
            <Service icon={Landmark} name="Charles Schwab" line="the brokerage and its data services" />
            <Wire label="market data feeds" />
            <Service icon={CandlestickChart} name="The markets" line="exchanges and consolidated quotes" />
          </div>
        </Band>
      </section>

      <div className="flex justify-center">
        <Wire label="the Mac connects outbound: commands down, pictures up" down />
      </div>

      <section aria-label="The cloud">
        <Band title="The cloud">
          <div className="flex flex-col items-center gap-2 lg:flex-row lg:justify-center">
            <div className="flex gap-3">
              <Service icon={Globe} name="Browser client" line="sign in with a Nostr key; view and change your displays" />
              <Service icon={Bot} name="MCP clients" line="any agent framework, over the Model Context Protocol" />
            </div>
            <Wire label="MCP over HTTPS" />
            <Service logo="cloudflare" name="Cloudflare Pages" line="hosts this site and proxies MCP traffic" />
            <Wire label="to the operator" />
            <Service logo="prefect" name="Prefect Horizon" line="hosts the ChartRemotely MCP operator" />
            <Wire label="state" />
            <Service logo="neon" name="Neon" line="Postgres: pairings, command queue, encrypted pictures for one hour" />
          </div>
        </Band>
      </section>

      <section aria-label="Tollbooth DPYC" className="mt-8">
        <Band title="Tollbooth DPYC™" subtitle="DPYC™ — Don't Pester Your Customer™">
          <div className="flex flex-wrap justify-center gap-4">
            <Service icon={KeyRound} name="Nostr" line="identity by npub, proven by signature" />
            <Service logo="bitcoin" name="Bitcoin" line="a prepaid balance, held in sats" />
            <Service icon={Zap} name="Lightning" line="instant top-ups, certified by a DPYC™ Authority" />
            <Service icon={SlidersHorizontal} name="Pricing Studio" line="operators set every tool's price live" />
          </div>
        </Band>
      </section>

      <p className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <Lock className="flex-none text-[var(--tb-accent)]" size={20} aria-hidden="true" />
        Your Mac accepts no inbound connections from the internet: it connects outbound to the operator, and voice
        commands stay inside your tailnet. Each picture is cropped to the chart pane before it leaves the Mac.
      </p>

      <div className="mt-8 text-center">
        <button type="button" onClick={() => go("welcome")} className="text-sm text-[var(--tb-accent)]">
          ← Back to the start
        </button>
      </div>

      <footer className="mt-12 space-y-3 border-t border-[var(--tb-line)] pt-6 text-[11px] leading-relaxed text-[var(--tb-muted)]">
        <div>
          <div className="mb-1">Photographs from Wikimedia Commons:</div>
          <ul className="space-y-0.5">
            {CREDITS.map((c) => (
              <li key={c.what}>
                {c.what}: <a href={c.page} className="underline">{c.title}</a> by {c.by}, {c.license}
                {c.cropped ? ", cropped" : ""}
                {"note" in c && c.note ? `, ${c.note}` : ""}.
              </li>
            ))}
          </ul>
          <div className="mt-1">
            Logos from <a href="https://simpleicons.org" className="underline">Simple Icons</a> (CC0).
          </div>
        </div>
        <p>
          Tollbooth DPYC™, DPYC™ and Don't Pester Your Customer™ are trademarks of Lonnie VanZandt. thinkorswim,
          Schwab, Apple, iPhone, iPad, Apple Watch, Mac mini, Siri, Tailscale, Cloudflare, Prefect and Neon are
          trademarks of their respective owners. ChartRemotely is not affiliated with or endorsed by any of them.
        </p>
      </footer>
    </div>
  );
}
