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
import { go } from "../lib/route";
import chartShot from "../assets/welcome/chart-ge.jpg";
import watchPhoto from "../assets/how/watch.jpg";
import { CREDITS } from "./HowItWorks";

const WATCH_CREDIT = CREDITS.find((c) => c.what === "Apple Watch")!;

const DAY: { icon: LucideIcon; when: string; text: string }[] = [
  {
    icon: Watch,
    when: "In the kitchen",
    text: "You raise your wrist: “Hey Siri, ChartRemotely.” It asks which company, which scale, and where. “GE Aerospace.” “Thirty minutes.” “Office.”",
  },
  {
    icon: MonitorPlay,
    when: "Across the room",
    text: "The thinkorswim monitor in your office is already on GE at thirty minutes. You read it from the doorway.",
  },
  {
    icon: Hotel,
    when: "From a hotel",
    text: "Same words on your iPhone. The chart on your desk at home changes, and its picture is waiting in your browser.",
  },
  {
    icon: Share2,
    when: "Into the pitch",
    text: "That picture is a cropped chart, ready to drop into a deck or an X post.",
  },
];

const PIECES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Mic, title: "Your voice", text: "A Siri Shortcut on iPhone, iPad or Apple Watch." },
  { icon: Bot, title: "Your agent", text: "Any MCP client drives the same screens: show a chart, read it, take its picture." },
  { icon: Camera, title: "Your screens", text: "Every chart change leaves a fresh picture here for an hour, one tap to view." },
  { icon: Zap, title: "Pay per request", text: "A prepaid Bitcoin Lightning balance, and a Nostr key for sign-in." },
];

export default function Welcome({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="py-16 md:py-24">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          Say it here.
          <br />
          <span className="text-[var(--tb-accent)]">See it there.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-[var(--tb-muted)]">
          Change the thinkorswim chart on any of your monitors by voice, from any room or any city, and get its
          picture back.
        </p>
        {/* The way to learn more sits left; the way in sits right. */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => go("how")}
            className="rounded-full border border-[var(--tb-line)] px-6 py-3 font-medium"
          >
            How it works
          </button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            {!signedIn && (
              <button
                type="button"
                onClick={() => go("signin")}
                className="rounded-full border border-[var(--tb-line)] px-6 py-3 font-medium"
              >
                Sign in
              </button>
            )}
            <button
              type="button"
              onClick={() => go(signedIn ? "screens" : "start")}
              className="rounded-full bg-[var(--tb-accent)] px-6 py-3 font-medium text-[var(--tb-on-accent)]"
            >
              {signedIn ? "My screens" : "Get started"}
            </button>
          </div>
        </div>

        <SaidHereSeenThere />
      </header>

      <section aria-labelledby="day">
        <h2 id="day" className="mb-4 text-sm uppercase tracking-wider text-[var(--tb-muted)]">
          A trader on the move
        </h2>
        <ol className="space-y-3">
          {DAY.map(({ icon: Icon, when, text }) => (
            <li
              key={when}
              className="flex items-start gap-4 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-5"
            >
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-[var(--tb-accent)]/12 text-[var(--tb-accent)]">
                <Icon size={30} aria-hidden="true" />
              </span>
              <div>
                <div className="font-medium">{when}</div>
                <p className="mt-1 text-sm text-[var(--tb-muted)]">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 grid gap-3 sm:grid-cols-2">
        {PIECES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-4 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-5">
            <Icon className="flex-none text-[var(--tb-accent)]" size={24} aria-hidden="true" />
            <div>
              <div className="font-medium">{title}</div>
              <div className="mt-1 text-sm text-[var(--tb-muted)]">{text}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-6">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <Sparkles size={18} className="text-[var(--tb-accent)]" aria-hidden="true" />
          What the AI missed
        </div>
        <p className="text-sm leading-relaxed text-[var(--tb-muted)]">
          ChartRemotely was built with an AI coding agent. The agent was sure the value lay in the analysis: volume
          profiles, squeezes, the maths on the chart. What the trader it was building for wanted was simpler: say a name
          from another room, watch the chart change on the wall, and have the picture in a pocket. People love easy
          visuals, and the easy part turned out to be the product.
        </p>
      </section>

      <p className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <ShieldCheck className="flex-none text-[var(--tb-accent)]" size={20} aria-hidden="true" />
        ChartRemotely changes what a chart shows and takes its picture. Orders, money and accounts stay with you and
        thinkorswim, and each picture is cropped to the chart itself.
      </p>

      <section className="mt-12 rounded-2xl border border-[var(--tb-line)] p-6">
        <div className="font-medium">A Tollbooth DPYC™ service</div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--tb-muted)]">
          ChartRemotely is an operator on the Tollbooth DPYC™ network — DPYC™ stands for Don't Pester Your Customer™.
          It is an MCP server that earns by the request over Bitcoin Lightning, priced live from the operator's Pricing
          Studio with no code changes. The same framework turns any useful tool into a business.
        </p>
        <button type="button" onClick={() => go("how")} className="mt-3 text-sm text-[var(--tb-accent)]">
          See how it fits together →
        </button>
      </section>

      <footer className="mt-16 flex flex-wrap gap-5 border-t border-[var(--tb-line)] py-8 text-sm text-[var(--tb-muted)]">
        <a href="https://github.com/lonniev/ChartRemotely-agent">Agent</a>
        <a href="https://github.com/lonniev/ChartRemotely-mcp">Operator</a>
        <a href="https://github.com/lonniev/tollbooth-dpyc">Tollbooth DPYC™</a>
        <p className="basis-full text-[11px] leading-relaxed">
          Chart: a thinkorswim capture made with ChartRemotely. {WATCH_CREDIT.what}:{" "}
          <a href={WATCH_CREDIT.page} className="underline">
            {WATCH_CREDIT.title}
          </a>{" "}
          by {WATCH_CREDIT.by}, {WATCH_CREDIT.license}, cropped, from Wikimedia Commons.
        </p>
        <p className="basis-full text-[11px] leading-relaxed">
          Tollbooth DPYC™, DPYC™ and Don't Pester Your Customer™ are trademarks of Lonnie VanZandt. thinkorswim, Schwab,
          Apple, iPhone, iPad, Apple Watch and Siri are trademarks of their respective owners. ChartRemotely is not
          affiliated with or endorsed by them.
        </p>
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
  return (
    <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-5">
      <Figure
        grow={3 / 5}
        label="Say it here"
        caption="“GE Aerospace. Thirty minutes.”"
        className="w-44 sm:w-auto"
      >
        <img
          src={watchPhoto}
          alt="An Apple Watch"
          width={270}
          height={614}
          className="block aspect-[3/5] h-auto w-full object-cover"
        />
      </Figure>
      <Figure grow={1200 / 797} label="See it there" caption="GE · 30m, cropped to the chart">
        <img
          src={chartShot}
          alt="A thinkorswim chart of GE Aerospace at thirty minutes, as captured from the monitor"
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
