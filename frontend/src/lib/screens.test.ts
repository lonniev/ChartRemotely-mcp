import assert from "node:assert/strict";
import { test } from "node:test";

import { displayNames, hasNewer, normalizeCode, orderDisplays, takenAgo, wrapIndex } from "./screens.ts";

const d = (label: string, agent_id: string, connected: boolean) => ({ label, agent_id, connected });

test("a live display leads, then names in order", () => {
  const out = orderDisplays([d("Wall", "a1", false), d("Desk", "b2", true), d("Attic", "c3", false)]);
  assert.deepEqual(out.map((x) => x.label), ["Desk", "Attic", "Wall"]);
});

test("two displays with one name are told apart; a unique name is left alone", () => {
  // The owner's account carries three leftover rows all called "display".
  const names = displayNames([d("display", "7f3a99", false), d("display", "c01d22", true), d("Desk", "e5e5e5", true)]);
  assert.equal(names.get("7f3a99"), "display · 7f3a");
  assert.equal(names.get("c01d22"), "display · c01d");
  assert.equal(names.get("e5e5e5"), "Desk");
});

test("snapshot ages read like a person would say them", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");
  assert.equal(takenAgo("2026-09-23T11:59:40Z", "UTC", now), "just now");
  assert.equal(takenAgo("2026-09-23T11:56:00Z", "UTC", now), "4 min ago");
  assert.equal(takenAgo("2026-09-23T10:00:00Z", "UTC", now), "2 h ago");
  assert.equal(takenAgo("not a date", "UTC", now), "");
});

test("a picture older than a day reads in the viewer's chosen zone", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");
  // 02:30 UTC on the 21st is still the 20th in Los Angeles.
  const la = takenAgo("2026-09-21T02:30:00Z", "America/Los_Angeles", now);
  const tokyo = takenAgo("2026-09-21T02:30:00Z", "Asia/Tokyo", now);
  assert.match(la, /20/);
  assert.match(tokyo, /21/);
  assert.notEqual(la, tokyo);
});

test("a pairing code is cleaned to the agent's alphabet", () => {
  // The agent never issues I, O, 0 or 1 — they are misread across a room.
  assert.equal(normalizeCode(" ab c-2o1 9x "), "ABC29X");
  assert.equal(normalizeCode("ABCDEFGH"), "ABCDEF");
});

test("indexes wrap both ways", () => {
  assert.equal(wrapIndex(-1, 3), 2);
  assert.equal(wrapIndex(3, 3), 0);
  assert.equal(wrapIndex(5, 0), 0);
});

test("a kept picture is offered only when it is newer than the one on screen", () => {
  assert.equal(hasNewer("2026-09-24T10:42:00Z", undefined), true);
  assert.equal(hasNewer("2026-09-24T10:42:00Z", "2026-09-24T10:40:00Z"), true);
  assert.equal(hasNewer("2026-09-24T10:42:00Z", "2026-09-24T10:42:00Z"), false);
  assert.equal(hasNewer(null, undefined), false);
  assert.equal(hasNewer("garbage", undefined), false);
});
