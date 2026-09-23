import assert from "node:assert/strict";
import { test } from "node:test";

import { displayNames, normalizeCode, orderDisplays, takenAgo, wrapIndex } from "./screens.ts";

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
  assert.equal(takenAgo("2026-09-23T11:59:40Z", now), "just now");
  assert.equal(takenAgo("2026-09-23T11:56:00Z", now), "4 min ago");
  assert.equal(takenAgo("2026-09-23T10:00:00Z", now), "2 h ago");
  assert.equal(takenAgo("not a date", now), "");
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
