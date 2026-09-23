/**
 * The front door. What it does, in pictures and a few words, and one way in.
 */

import { Camera, Download, Link2, Mic, ShieldCheck } from "lucide-react";
import { go } from "../lib/route";

const STEPS = [
  { icon: Download, title: "Install", text: "A small agent on the Mac that drives your chart." },
  { icon: Link2, title: "Pair", text: "Type the code it shows. Nothing on your network opens." },
  { icon: Mic, title: "Say it", text: "“Palantir, scalp.” The chart changes, wherever it is." },
  { icon: Camera, title: "See it", text: "A live picture of every screen, from any browser." },
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
          Put a security on a thinkorswim chart anywhere in the world — a wall monitor in another building, a screen
          you left behind.
        </p>
        <button
          type="button"
          onClick={() => go(signedIn ? "screens" : "signin")}
          className="mt-8 rounded-full bg-[var(--tb-accent)] px-6 py-3 font-medium text-[var(--tb-on-accent)]"
        >
          {signedIn ? "My screens" : "Sign in"}
        </button>
      </header>

      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-5">
            <Icon className="flex-none text-[var(--tb-accent)]" size={24} aria-hidden="true" />
            <div>
              <div className="font-medium">{title}</div>
              <div className="mt-1 text-sm text-[var(--tb-muted)]">{text}</div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <ShieldCheck className="flex-none text-[var(--tb-accent)]" size={20} aria-hidden="true" />
        It can't trade, move money or read an account. It only changes what the chart shows.
      </p>

      <footer className="mt-16 flex flex-wrap gap-5 border-t border-[var(--tb-line)] py-8 text-sm text-[var(--tb-muted)]">
        <a href="https://github.com/lonniev/ChartRemotely-agent">Agent</a>
        <a href="https://github.com/lonniev/ChartRemotely-mcp">Operator</a>
        <a href="https://github.com/lonniev/tollbooth-dpyc">Tollbooth DPYC</a>
      </footer>
    </div>
  );
}
