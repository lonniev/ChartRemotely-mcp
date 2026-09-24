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
import { go } from "../lib/route";

const DAY: { icon: LucideIcon; when: string; text: string }[] = [
  {
    icon: Watch,
    when: "In the kitchen",
    text: "You raise your wrist: “Hey Siri, ChartRemotely.” It asks which company, then which scale. “Palantir.” “Swing.”",
  },
  {
    icon: MonitorPlay,
    when: "Across the room",
    text: "The thinkorswim monitor in your office is already on PLTR at swing. You read it from the doorway.",
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
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => go(signedIn ? "screens" : "signin")}
            className="rounded-full bg-[var(--tb-accent)] px-6 py-3 font-medium text-[var(--tb-on-accent)]"
          >
            {signedIn ? "My screens" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => go("how")}
            className="rounded-full border border-[var(--tb-line)] px-6 py-3 font-medium"
          >
            How it works
          </button>
        </div>
      </header>

      <section aria-labelledby="day">
        <h2 id="day" className="mb-4 text-sm uppercase tracking-wider text-[var(--tb-muted)]">
          A trader on the move
        </h2>
        <ol className="relative space-y-3 border-l border-[var(--tb-line)] pl-6">
          {DAY.map(({ icon: Icon, when, text }) => (
            <li key={when} className="relative">
              <span className="absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tb-surface-2)] text-[var(--tb-accent)] ring-4 ring-[#0b0d10]">
                <Icon size={14} aria-hidden="true" />
              </span>
              <div className="rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-5">
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
          Tollbooth DPYC™, DPYC™ and Don't Pester Your Customer™ are trademarks of Lonnie VanZandt. thinkorswim, Schwab,
          Apple, iPhone, iPad, Apple Watch and Siri are trademarks of their respective owners. ChartRemotely is not
          affiliated with or endorsed by them.
        </p>
      </footer>
    </div>
  );
}
