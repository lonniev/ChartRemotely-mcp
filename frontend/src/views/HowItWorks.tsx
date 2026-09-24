/**
 * How the pieces fit: who talks to whom, over what, and where each part runs.
 *
 * The diagram is plain boxes and arrows in HTML, readable at phone width.
 */

import {
  ArrowDown,
  Bot,
  Cloud,
  Database,
  Globe,
  KeyRound,
  Laptop,
  Lock,
  Monitor,
  Server,
  Smartphone,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { go } from "../lib/route";

function Node({ icon: Icon, title, where, children }: {
  icon: LucideIcon;
  title: string;
  where: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="flex-none text-[var(--tb-accent)]" aria-hidden="true" />
        <span className="font-medium">{title}</span>
        <span className="ml-auto text-[11px] uppercase tracking-wider text-[var(--tb-muted)]">{where}</span>
      </div>
      <div className="mt-2 text-sm leading-relaxed text-[var(--tb-muted)]">{children}</div>
    </div>
  );
}

function Link({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-5 text-xs text-[var(--tb-muted)]">
      <ArrowDown size={14} className="text-[var(--tb-accent)]" aria-hidden="true" />
      {label}
    </div>
  );
}

const PARTS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Smartphone,
    title: "Apple",
    text: "A Siri Shortcut asks which company and which scale, checks each with your Mac, then sets the chart, all over HTTPS. It runs on iPhone, iPad and Apple Watch, and your Mac grants the agent Accessibility (to drive the chart) and Screen Recording (to picture it).",
  },
  {
    icon: KeyRound,
    title: "Tailscale",
    text: "Your devices reach your Mac over your own private tailnet. Tailscale Serve gives the Mac a real HTTPS address that exists only inside that tailnet, and the agent listens on the Mac's loopback behind it.",
  },
  {
    icon: Laptop,
    title: "The Mac agent",
    text: "A small, open-source Python agent with a short fixed vocabulary: show, scale, read, snapshot. It resolves spoken company names against the SEC registry, types into thinkorswim's symbol box, and crops every picture to the chart pane.",
  },
  {
    icon: Cloud,
    title: "Cloudflare",
    text: "Cloudflare Pages serves this site, and a Pages Function at /mcp forwards the browser's MCP requests to the operator, so the page and its tools share one origin.",
  },
  {
    icon: Server,
    title: "Prefect Horizon",
    text: "Horizon hosts the ChartRemotely operator: an MCP server any MCP client can call. It pairs displays, relays commands, and keeps each display's newest picture. The agent dials out to it and holds a long poll open, so your network opens no ports.",
  },
  {
    icon: Database,
    title: "Neon",
    text: "Postgres for the operator's pairings, its command queue and the kept pictures. Each picture is encrypted with a key derived from the operator's Nostr key, bound to its display, and deleted after an hour.",
  },
  {
    icon: Zap,
    title: "Tollbooth DPYC",
    text: "The network that makes this a business. You sign in with a Nostr npub and a signed proof. You pay per request from a prepaid Bitcoin Lightning balance. A DPYC Authority certifies each top-up, and the operator sets every price live from Pricing Studio.",
  },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 max-w-xl text-[var(--tb-muted)]">
        Three ways in, one agent on your Mac, and a chart that changes on the screen you point at.
      </p>

      <section aria-label="Network diagram" className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-[var(--tb-muted)]">By voice, on your tailnet</div>
          <Node icon={Smartphone} title="iPhone · iPad · Watch" where="Apple">
            “Hey Siri, ChartRemotely.” The Shortcut asks, then posts your words.
          </Node>
          <Link label="HTTPS over Tailscale, with your agent's token" />
          <Node icon={Laptop} title="Your Mac" where="Tailscale Serve">
            The agent resolves the name, drives thinkorswim, and says what it did.
          </Node>
          <Link label="Accessibility keystrokes" />
          <Node icon={Monitor} title="thinkorswim monitor" where="your room">
            The chart changes. A second later the agent takes its picture.
          </Node>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-[var(--tb-muted)]">In a browser, or from an agent</div>
          <Node icon={Globe} title="This site · any MCP client" where="anywhere">
            Sign in with Nostr. Pick a screen, change it, or tap to view its picture.
          </Node>
          <Link label="MCP over HTTPS, through Cloudflare's /mcp" />
          <Node icon={Server} title="ChartRemotely operator" where="Prefect Horizon">
            Checks your proof, charges the request, queues the command.
          </Node>
          <Link label="the agent's own long poll, dialled out from your Mac" />
          <Node icon={Laptop} title="Your Mac" where="outbound only">
            Runs the command and answers. After each chart change it sends up the picture, which the operator keeps
            encrypted for an hour.
          </Node>
        </div>
      </section>

      <section className="mt-12 space-y-3">
        {PARTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-4 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-5">
            <Icon className="mt-0.5 flex-none text-[var(--tb-accent)]" size={20} aria-hidden="true" />
            <div>
              <h2 className="font-medium">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--tb-muted)]">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--tb-line)] p-6">
        <div className="flex items-center gap-2 font-medium">
          <Bot size={18} className="text-[var(--tb-accent)]" aria-hidden="true" />
          For agentic harnesses
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--tb-muted)]">
          The operator is a standard MCP server at <code className="font-mono">chartremotely-mcp.fastmcp.app/mcp</code>.
          An agent asks for your npub, you answer one Nostr DM to prove it is yours, and from then on it can show a
          chart, read it, or fetch its picture for a report, a deck or a post.
        </p>
      </section>

      <p className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--tb-line)] p-5 text-sm text-[var(--tb-muted)]">
        <Lock className="flex-none text-[var(--tb-accent)]" size={20} aria-hidden="true" />
        Every connection is outbound from your Mac or private to your tailnet. Pictures show the chart pane alone, and the
        agent's vocabulary covers charts and nothing else.
      </p>

      <button
        type="button"
        onClick={() => go("welcome")}
        className="mt-10 text-sm text-[var(--tb-accent)]"
      >
        ← Back to the start
      </button>
    </div>
  );
}
