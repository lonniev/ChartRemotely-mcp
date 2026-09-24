/**
 * ChartRemotely's own tools. Sign-in, proofs, balance and profile come from
 * @tollbooth-dpyc/web; only what this operator adds is here.
 */

import { callTool, callToolWithContent } from "@tollbooth-dpyc/web";

export interface Display {
  label: string;
  agent_id: string;
  connected: boolean;
}

interface Failure {
  ok?: false;
  success?: false;
  error?: string;
}

function failed(r: unknown): string | null {
  const f = r as Failure | null;
  if (f && typeof f === "object" && (f.ok === false || f.success === false || f.error)) {
    return f.error ?? "The service refused that.";
  }
  return null;
}

export async function listDisplays(): Promise<Display[]> {
  const r = await callTool<{ displays?: Display[] } & Failure>("agent_status");
  const err = failed(r);
  if (err) throw new Error(err);
  return r.displays ?? [];
}

export async function pairDisplay(code: string, label: string): Promise<Display> {
  const r = await callTool<{ display?: string; agent_id?: string } & Failure>("pair_agent", { code, label });
  const err = failed(r);
  if (err) throw new Error(err);
  return { label: r.display ?? label, agent_id: r.agent_id ?? "", connected: false };
}

/** By agent_id, never by name: two leftover rows can share a name. */
export async function forgetDisplay(agentId: string): Promise<void> {
  const err = failed(await callTool("forget_display", { display: agentId }));
  if (err) throw new Error(err);
}

export interface Snapshot {
  /** A data: URL the page can put straight into an <img>. */
  src: string;
  takenAt: string;
}

/** Metered. Costs nothing when the display is offline or cannot capture. */
export async function takeSnapshot(agentId: string): Promise<Snapshot> {
  const { data, images } = await callToolWithContent<{ taken_at?: string } & Failure>(
    "snapshot_display",
    { display: agentId },
    { timeoutMs: 60_000 },
  );
  const err = failed(data);
  if (err) throw new Error(err);
  const img = images[0];
  if (!img) throw new Error("The display answered without a picture.");
  return { src: `data:${img.mimeType};base64,${img.data}`, takenAt: data.taken_at ?? new Date().toISOString() };
}

export interface Shortcut {
  url: string;
  after_import?: string;
}

export function getShortcut(): Promise<Shortcut> {
  return callTool<Shortcut>("get_shortcut");
}
