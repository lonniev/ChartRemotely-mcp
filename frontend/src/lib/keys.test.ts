import assert from "node:assert/strict";
import { test } from "node:test";
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";

import { npubForNsec } from "./keys.ts";

test("a valid nsec yields the npub it belongs to", () => {
  const sk = generateSecretKey();
  assert.equal(npubForNsec(`  ${nip19.nsecEncode(sk)}\n`), nip19.npubEncode(getPublicKey(sk)));
});

test("anything else yields nothing", () => {
  const npub = nip19.npubEncode(getPublicKey(generateSecretKey()));
  assert.equal(npubForNsec(npub), null, "an npub is not a secret key");
  assert.equal(npubForNsec("nsec1notreallyakey"), null);
  assert.equal(npubForNsec(""), null);
});
