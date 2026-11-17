/**
 * The front door: one trader's day, told in a few beats, and one way in.
 */

import {
  Bot,
  Camera,
  Hotel,
  Mic,
  MonitorPlay,
  Share2,
  ShieldCheck,
  Sparkles,
  Watch,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { LanguageChooser, Tx } from "@tollbooth-dpyc/web/react";
import { go } from "../lib/route";
import { useT, WORDS } from "../i18n";
import chartShot from "../assets/welcome/chart-ge.jpg";
import watchPhoto from "../assets/how/watch.jpg";
import { CREDITS } from "./HowItWorks";

const WATCH_CREDIT = CREDITS.find((c) => c.id === "watch")!;

const DAY: { icon: LucideIcon; id: "kitchen" | "room" | "hotel" | "pitch" }[] = [
  { icon: Watch, id: "kitchen" },
  { icon: MonitorPlay, id: "room" },
  { icon: Hotel, id: "hotel" },
  { icon: Share2, id: "pitch" },
];

const PIECES: { icon: LucideIcon; id: "voice" | "agent" | "screens" | "pay" }[] = [
  { icon: Mic, id: "voice" },
  { icon: Bot, id: "agent" },
  { icon: Camera, id: "screens" },
  { icon: Zap, id: "pay" },
];

export default function Welcome({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="py-16 md:py-24">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          {t("views.welcome.title.say")}
          <br />
          <span className="text-[var(--tb-accent)]">{t("views.welcome.title.see")}</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-[var(--tb-muted)]">
          {t("views.welcome.lede")}
        </p>
        {/* The way to learn more sits left; the way in sits right. */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => go("how")}
            className="rounded-full border border-[var(--tb-line)] px-6 py-3 font-medium"
          >
            {t("views.welcome.how")}
          </button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            {!signedIn && (
              <button
                type="button"
                onClick={() => go("signin")}
                className="rounded-full border border-[var(--tb-line)] px-6 py-3 font-medium"
              >
                {t("ui.app.signIn")}
              </button>
            )}
            <button
              type="button"
              onClick={() => go(signedIn ? "screens" : "start")}
              className="rounded-full bg-[var(--tb-accent)] px-6 py-3 font-medium text-[var(--tb-on-accent)]"
            >
              {signedIn ? t("ui.app.myScreens") : t("ui.app.getStarted")}
            </button>
          </div>
        </div>

        <SaidHereSeenThere />
      </header>

      <section aria-labelledby="day">
        <h2 id="day" className="mb-4 text-sm uppercase tracking-wider text-[var(--tb-muted)]">
          {t("views.welcome.day.heading")}
        </h2>
        <ol className="space-y-3">
          {DAY.map(({ icon: Icon, id }) => (
            <li
              key={id}
              className="flex items-start gap-4 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-5"
            >
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-[var(--tb-accent)]/12 text-[var(--tb-accent)]">
                <Icon size={30} aria-hidden="true" />
              </span>
              <div>
                <div className="font-medium">{t(`views.welcome.day.${id}.when`)}</div>
                <p className="mt-1 text-sm text-[var(--tb-muted)]">{t(`views.welcome.day.${id}.text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 grid gap-3 sm:grid-cols-2">
        {PIECES.map(({ icon: Icon, id }) => (
          <div key={id} className="flex gap-4 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-5">
            <Icon className="flex-none text-[var(--tb-accent)]" size={24} aria-hidden="true" />
            <div>
              <div className="font-medium">{t(`views.welcome.piece.${id}.title`)}</div>
              <div className="mt-1 text-sm text-[var(--tb-muted)]">{t(`views.welcome.piece.${id}.text`)}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-6">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <Sparkles size={18} className="text-[var(--tb-accent)]" aria-hidden="true" />
          {t("views.welcome.missed.title")}
        </div>
        <p className="text-sm leading-relaxed text-[var(--tb-muted)]">
          {t("views.welcome.missed.text")}
        </p>
      </section>

      <p className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <ShieldCheck className="flex-none text-[var(--tb-accent)]" size={20} aria-hidden="true" />
        {t("views.welcome.safe")}
      </p>

      <section className="mt-12 rounded-2xl border border-[var(--tb-line)] p-6">
        <div className="font-medium">{t("views.welcome.dpyc.title")}</div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--tb-muted)]">
          {t("views.welcome.dpyc.text")}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--tb-accent)]">
          <button type="button" onClick={() => go("how")}>
            {t("views.welcome.dpyc.how")}
          </button>
          <button type="button" onClick={() => go("prices")}>
            {t("views.welcome.dpyc.prices")}
          </button>
        </div>
      </section>

      <footer className="mt-16 flex flex-wrap gap-5 border-t border-[var(--tb-line)] py-8 text-sm text-[var(--tb-muted)]">
        <a href="#/prices">{t("views.welcome.footer.prices")}</a>
        <a href="https://github.com/lonniev/ChartRemotely-agent">{t("views.welcome.footer.agent")}</a>
        <a href="https://github.com/lonniev/ChartRemotely-mcp">{t("views.welcome.footer.operator")}</a>
        <a href="https://github.com/lonniev/tollbooth-dpyc">Tollbooth DPYC™</a>
        <div className="basis-full">
          <LanguageChooser />
        </div>
        <p className="basis-full text-[11px] leading-relaxed">
          <Tx ns={WORDS} k="views.welcome.footer.credit"
            vars={{ what: WATCH_CREDIT.what ?? "", by: WATCH_CREDIT.by ?? t("views.how.credits.unknown"), license: WATCH_CREDIT.license }}
            components={{ photo: <a href={WATCH_CREDIT.page} className="underline">{WATCH_CREDIT.title}</a> }} />
        </p>
        <p className="basis-full text-[11px] leading-relaxed">{t("views.welcome.footer.marks")}</p>
      </footer>
    </div>
  );
}

/**
 * The promise in two pictures, side by side: the watch a word is said to, and
 * the chart that word put on a monitor elsewhere. Each is its own figure.
 * On a wide screen the two share one height (each column grows in proportion
 * to its picture's aspect ratio); on a phone they stack, watch first.
 */
function SaidHereSeenThere() {
  const t = useT();
  return (
    <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-5">
      <Figure
        grow={3 / 5}
        label={t("views.welcome.said.label")}
        caption={t("views.welcome.said.caption")}
        className="w-44 sm:w-auto"
      >
        <img
          src={watchPhoto}
          alt={t("views.welcome.said.alt")}
          width={270}
          height={614}
          className="block aspect-[3/5] h-auto w-full object-cover"
        />
      </Figure>
      <Figure grow={1200 / 797} label={t("views.welcome.seen.label")} caption={t("views.welcome.seen.caption")}>
        <img
          src={chartShot}
          alt={t("views.welcome.seen.alt")}
          width={1200}
          height={797}
          className="block h-auto w-full"
        />
      </Figure>
    </div>
  );
}

function Figure({
  grow,
  label,
  caption,
  className = "",
  children,
}: {
  grow: number;
  label: string;
  caption: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={`m-0 min-w-0 ${className}`} style={{ flex: `${grow} 1 0%` }}>
      {/* A ring, not a border: it takes no width, so the two heights stay equal. */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-[var(--tb-line)]">{children}</div>
      <figcaption className="mt-3 text-sm">
        <span className="block font-medium text-[var(--tb-accent)]">{label}</span>
        <span className="block text-balance text-[var(--tb-muted)]">{caption}</span>
      </figcaption>
    </figure>
  );
}
