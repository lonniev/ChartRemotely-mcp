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
import { Tx } from "@tollbooth-dpyc/web/react";
import { go } from "../lib/route";
import { useT, WORDS } from "../i18n";

/**
 * The page's images, bundled by Vite so each URL carries a content hash. The
 * domain tells browsers to keep images for hours; a hashed name means a
 * changed picture is a new URL, seen on the next visit rather than later.
 */
const ASSETS = import.meta.glob("../assets/how/**/*", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

function asset(path: string): string {
  const url = ASSETS[`../assets/how/${path}`];
  if (!url) throw new Error(`missing How it works image: ${path}`);
  return url;
}

/**
 * A real object: a photo in a rounded frame, with its name and one line.
 * Every device frame shares one height, so phone, tablet and watch line up.
 */
function Photo({ src, alt, name, line, width = "w-28" }: {
  src: string; alt: string; name: string; line: string; width?: string;
}) {
  return (
    <figure className={`flex flex-none flex-col items-center text-center ${width}`}>
      <div className="h-32 w-full overflow-hidden rounded-2xl bg-[var(--tb-surface-2)] ring-1 ring-[var(--tb-line)] sm:h-36">
        <img src={asset(src)} alt={alt} loading="lazy" className="h-full w-full object-cover" />
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
          <img src={asset(`logos/${logo}.svg`)} alt="" className="h-12 w-12 invert" />
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
  const t = useT();
  return (
    <figure className="flex w-40 flex-none flex-col items-center text-center sm:w-44">
      <div className="w-full rounded-xl bg-[#1b1f24] p-1.5 shadow-[0_0_40px_-10px_var(--tb-accent)] ring-1 ring-[#2a3038]">
        <div className="aspect-[16/10] overflow-hidden rounded-md">
          <img src={asset("chart.jpg")} alt={t("views.how.monitor.alt")} loading="lazy" className="h-full w-full object-cover" />
        </div>
      </div>
      <div className="mx-auto h-3 w-8 bg-[#2a3038]" aria-hidden="true" />
      <div className="mx-auto h-1.5 w-16 rounded-full bg-[#2a3038]" aria-hidden="true" />
      <figcaption className="mt-2 text-sm font-medium">thinkorswim</figcaption>
      <div className="text-xs leading-snug text-[var(--tb-muted)]">{t("views.how.monitor.line")}</div>
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
        {logo && <img src={asset(`logos/${logo}.svg`)} alt="" className="h-3.5 w-3.5 invert" />}
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

/**
 * Each photograph's credit. A product's name stays as it is; ``what: null``
 * and ``by: null`` are said in the reader's language ("Chart screen",
 * "unknown author").
 */
export const CREDITS: {
  id: string; what: string | null; title: string; by: string | null; license: string; page: string; cropped: boolean;
}[] = [
  { id: "iphone", what: "iPhone", title: "Apple iPhone 15 Pro", by: "IPHONE 15", license: "CC BY-SA 4.0",
    page: "https://commons.wikimedia.org/wiki/File:Apple_iPhone_15_Pro.jpg", cropped: true },
  { id: "watch", what: "Apple Watch", title: "Apple Watch Series 7; January 2022 (01)", by: "MIKI Yoshihito", license: "CC BY 2.0",
    page: "https://commons.wikimedia.org/wiki/File:Apple_Watch_Series_7;_January_2022_(01).jpg", cropped: true },
  { id: "mac", what: "Mac mini", title: "Mac mini M4 2024-11-16 1", by: "Yelderberry", license: "CC BY-SA 4.0",
    page: "https://commons.wikimedia.org/wiki/File:Mac_mini_M4_2024-11-16_1.jpg", cropped: true },
  { id: "chart", what: null, title: "Stock market charts illustration", by: null, license: "CC0",
    page: "https://commons.wikimedia.org/wiki/File:Stock_market_charts_illustration.jpg", cropped: false },
];

export default function HowItWorks() {
  const t = useT();
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10">
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

      <h1 className="text-3xl font-semibold tracking-tight">{t("views.how.title")}</h1>
      <p className="mt-3 text-[var(--tb-muted)]">
        {t("views.how.lede")}
      </p>

      <section aria-label={t("views.how.tailnet.title")} className="mt-10">
        <Band title={t("views.how.tailnet.title")} logo="tailscale" subtitle={t("views.how.tailnet.subtitle")}>
          <div className="flex flex-col items-center">
            <Lan icon={Home} name={t("views.how.home")}>
              <div className="flex flex-col items-center gap-2 lg:flex-row">
                <div className="flex gap-3">
                  <Photo src="iphone.jpg" alt={t("views.how.iphone.alt")} name="iPhone" line={t("views.how.siri")} width="w-20" />
                  <Photo src="watch.jpg" alt={t("views.how.watch.alt")} name="Apple Watch" line={t("views.how.siri")} width="w-20" />
                </div>
                <Wire label={t("views.how.wire.tailnet")} />
                <Photo src="mac-mini.jpg" alt={t("views.how.mac.alt")} name="Mac mini" line={t("views.how.mac.line")} width="w-36" />
                <Wire label={t("views.how.wire.keystrokes")} />
                <Monitor />
              </div>
            </Lan>
            <Wire label={t("views.how.wire.joins")} down />
            <Lan icon={Hotel} name={t("views.how.hotel")}>
              <div className="flex justify-center">
                <Photo src="ipad.jpg" alt={t("views.how.ipad.alt")} name="iPad" line={t("views.how.ipad.line")} width="w-36" />
              </div>
            </Lan>
          </div>
        </Band>
      </section>

      <section aria-label={t("views.how.market.title")} className="mt-8">
        <Band title={t("views.how.market.title")}>
          <div className="flex flex-col items-center gap-2 lg:flex-row lg:justify-center">
            <Service icon={TrendingUp} name="thinkorswim" line={t("views.how.tos.line")} />
            <Wire label={t("views.how.wire.quotes")} />
            <Service icon={Landmark} name="Charles Schwab" line={t("views.how.schwab.line")} />
            <Wire label={t("views.how.wire.feeds")} />
            <Service icon={CandlestickChart} name={t("views.how.markets.name")} line={t("views.how.markets.line")} />
          </div>
        </Band>
      </section>

      <div className="flex justify-center">
        <Wire label={t("views.how.wire.outbound")} down />
      </div>

      <section aria-label={t("views.how.cloud.title")}>
        <Band title={t("views.how.cloud.title")}>
          <div className="flex flex-col items-center gap-2 lg:flex-row lg:justify-center">
            <div className="flex gap-3">
              <Service icon={Globe} name={t("views.how.browser.name")} line={t("views.how.browser.line")} />
              <Service icon={Bot} name={t("views.how.mcp.name")} line={t("views.how.mcp.line")} />
            </div>
            <Wire label={t("views.how.wire.mcp")} />
            <Service logo="cloudflare" name="Cloudflare Pages" line={t("views.how.pages.line")} />
            <Wire label={t("views.how.wire.operator")} />
            <Service logo="prefect" name="Prefect Horizon" line={t("views.how.horizon.line")} />
            <Wire label={t("views.how.wire.state")} />
            <Service logo="neon" name="Neon" line={t("views.how.neon.line")} />
          </div>
        </Band>
      </section>

      <section aria-label="Tollbooth DPYC" className="mt-8">
        <Band title="Tollbooth DPYC™" subtitle="DPYC™ — Don't Pester Your Customer™">
          <div className="flex flex-wrap justify-center gap-4">
            <Service icon={KeyRound} name="Nostr" line={t("views.how.nostr.line")} />
            <Service logo="bitcoin" name="Bitcoin" line={t("views.how.bitcoin.line")} />
            <Service icon={Zap} name="Lightning" line={t("views.how.lightning.line")} />
            <Service icon={SlidersHorizontal} name="Pricing Studio" line={t("views.how.studio.line")} />
          </div>
        </Band>
      </section>

      <p className="mt-10 flex items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <Lock className="flex-none text-[var(--tb-accent)]" size={20} aria-hidden="true" />
        {t("views.how.safe")}
      </p>

      <div className="mt-8 text-center">
        <button type="button" onClick={() => go("welcome")} className="text-sm text-[var(--tb-accent)]">
          {t("ui.app.back")}
        </button>
      </div>

      <footer className="mt-12 space-y-3 border-t border-[var(--tb-line)] pt-6 text-[11px] leading-relaxed text-[var(--tb-muted)]">
        <div>
          <div className="mb-1">{t("views.how.credits.heading")}</div>
          <ul className="space-y-0.5">
            {CREDITS.map((c) => (
              <li key={c.id}>
                <Tx ns={WORDS} k={c.cropped ? "views.how.credits.lineCropped" : "views.how.credits.line"}
                  vars={{ what: c.what ?? t("views.how.credits.chart"), by: c.by ?? t("views.how.credits.unknown"), license: c.license }}
                  components={{ photo: <a href={c.page} className="underline">{c.title}</a> }} />
              </li>
            ))}
          </ul>
          <div className="mt-1">{t("views.how.credits.ipad")}</div>
          <div className="mt-1">
            <Tx ns={WORDS} k="views.how.credits.logos" components={{ icons: <a href="https://simpleicons.org" className="underline" /> }} />
          </div>
        </div>
        <p>{t("views.how.marks")}</p>
      </footer>
    </div>
  );
}
