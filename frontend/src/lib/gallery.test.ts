import assert from "node:assert/strict";
import { test } from "node:test";

import { captureCount, flattenCaptures, groupBySymbol, indexOr0 } from "./gallery.ts";

const cap = (id: string, minute: number, scale?: string) => ({
  id,
  taken_at: `2026-09-26T10:${String(minute).padStart(2, "0")}:00Z`,
  ...(scale ? { scale } : {}),
});

const names = new Map([
  ["a1", "Desk"],
  ["b2", "Wall"],
]);

test("a symbol captured on two displays is one group, its captures merged newest first", () => {
  const groups = groupBySymbol(
    [
      { agent_id: "a1", label: "desk", kept: [{ symbol: "PLTR", name: "PLTR", captures: [cap("p3", 30), cap("p1", 10)] }] },
      { agent_id: "b2", label: "wall", kept: [{ symbol: "PLTR", name: "PLTR", captures: [cap("p2", 20, "half")] }] },
    ],
    names,
  );
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].captures.map((c) => [c.id, c.display]), [["p3", "Desk"], ["p2", "Wall"], ["p1", "Desk"]]);
  assert.equal(groups[0].captures[1].scale, "half");
  assert.equal(groups[0].lastAt, "2026-09-26T10:30:00Z");
});

test("symbols are ordered by their newest capture on any display", () => {
  const groups = groupBySymbol(
    [
      { agent_id: "a1", label: "desk", kept: [
        { symbol: "NVDA", name: "NVDA", captures: [cap("n1", 40)] },
        { symbol: "PLTR", name: "PLTR", captures: [cap("p1", 5)] },
      ] },
      { agent_id: "b2", label: "wall", kept: [
        { symbol: "PLTR", name: "PLTR", captures: [cap("p2", 50)] },
        { symbol: "-", name: "Chart", captures: [cap("c1", 1)] },
      ] },
    ],
    names,
  );
  assert.deepEqual(groups.map((g) => g.name), ["PLTR", "NVDA", "Chart"]);
});

test("a display with nothing kept, or a symbol with no captures, adds nothing", () => {
  assert.deepEqual(groupBySymbol([{ agent_id: "a1", label: "desk" }], names), []);
  assert.deepEqual(groupBySymbol([{ agent_id: "a1", label: "desk", kept: [{ symbol: "X", name: "X", captures: [] }] }], names), []);
});

test("a remembered key is found again after a reorder, else the newest leads", () => {
  assert.equal(indexOr0(["a", "b", "c"], (x) => x === "c"), 2);
  assert.equal(indexOr0(["a", "b"], (x) => x === "gone"), 0);
});

test("counts read naturally", () => {
  assert.equal(captureCount(1), "1 capture");
  assert.equal(captureCount(6), "6 captures");
});

test("full screen walks every capture symbol by symbol, each symbol newest first, and knows the symbol", () => {
  const groups = groupBySymbol(
    [
      { agent_id: "a1", label: "desk", kept: [
        { symbol: "NVDA", name: "NVDA", captures: [cap("n1", 40), cap("n2", 45)] },
        { symbol: "-", name: "Chart", captures: [cap("c1", 1)] },
      ] },
    ],
    names,
  );
  const flat = flattenCaptures(groups);
  assert.deepEqual(flat.map((f) => [f.id, f.name]), [["n2", "NVDA"], ["n1", "NVDA"], ["c1", "Chart"]]);
  assert.equal(flat[2].symbol, "-");
  assert.equal(flat[0].display, "Desk");
  assert.deepEqual(flattenCaptures([]), []);
});
