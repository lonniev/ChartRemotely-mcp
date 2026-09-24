/**
 * Save your key: where setup sends someone who has just created a Nostr key.
 *
 * Setup leaves the new nsec on the clipboard for a minute and opens this page.
 * It is a real sign-in form — npub as the username, nsec as the password — so
 * Safari offers to save the pair to iCloud Passwords. From there it syncs to the
 * person's other devices, and Pricing Studio can fill it in through Password
 * AutoFill. Submitting signs in with that key in this browser. The key goes
 * nowhere else: it is never sent, logged or kept outside this browser's own
 * session storage for it.
 */

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { setSessionNsec, setStoredNpub } from "@tollbooth-dpyc/web";
import type { Session } from "@tollbooth-dpyc/web/react";
import { npubForNsec } from "../lib/keys";
import { go } from "../lib/route";

const field =
  "mt-1 w-full rounded-lg border border-[var(--tb-line)] bg-transparent px-3 py-2.5 font-mono text-sm focus:border-[var(--tb-accent)] focus:outline-none";

export default function SaveKey({ session }: { session: Session }) {
  const [nsec, setNsec] = useState("");
  const [error, setError] = useState("");
  const npub = npubForNsec(nsec) ?? "";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!npub) {
      setError("That is not a valid nsec. Paste the key setup placed on your clipboard.");
      return;
    }
    setSessionNsec(nsec.trim());
    setStoredNpub(npub);
    session.refresh();
    go("screens");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound size={20} className="text-[var(--tb-accent)]" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Save your key</h1>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-[var(--tb-muted)]">
        Setup created your Nostr key and placed it on your clipboard. Paste it below and sign in. Safari then offers to
        save it to iCloud Passwords, so it is available on your other devices, and Pricing Studio can fill it in when you
        add yourself as a patron.
      </p>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--tb-line)] bg-[var(--tb-surface)] p-5">
        <label className="block text-xs text-[var(--tb-muted)]">
          Your npub (public — your account name)
          <input
            name="username"
            autoComplete="username"
            value={npub}
            readOnly
            placeholder="filled in from your key"
            className={field}
          />
        </label>
        <label className="block text-xs text-[var(--tb-muted)]">
          Your nsec (secret — your password)
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={nsec}
            onChange={(e) => {
              setNsec(e.target.value);
              setError("");
            }}
            placeholder="nsec1…"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className={field}
          />
        </label>
        {error && <p className="text-xs text-[var(--tb-err-ink)]">{error}</p>}
        <button
          type="submit"
          disabled={!npub}
          className="w-full rounded-full bg-[var(--tb-accent)] py-2.5 text-sm font-medium text-[var(--tb-on-accent)] disabled:opacity-40"
        >
          Sign in and save
        </button>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-[var(--tb-muted)]">
        Keep a second copy somewhere safe. Your nsec is the only way to act as your npub, and nobody — including
        ChartRemotely — can recover it for you.
      </p>
    </div>
  );
}
