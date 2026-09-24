/**
 * Reading a pasted Nostr key. Pure, so the rules are tested without a browser.
 *
 * Nothing here stores, logs or sends a key: it only says what the text is and,
 * for a secret key, which public key it belongs to.
 */

import { getPublicKey, nip19 } from "nostr-tools";

/** The npub a bech32 nsec belongs to, or null when the text is not a valid nsec. */
export function npubForNsec(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith("nsec1")) return null;
  try {
    const decoded = nip19.decode(t);
    if (decoded.type !== "nsec") return null;
    return nip19.npubEncode(getPublicKey(decoded.data as Uint8Array));
  } catch {
    return null;
  }
}
