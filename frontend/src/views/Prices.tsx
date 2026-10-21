/** Every tool, what it does and its live fare: the fleet's price sheet, on the desk's palette. */

import { PriceSheet } from "@tollbooth-dpyc/web/react";
import { go } from "../lib/route";

export default function Prices() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PriceSheet />
      <div className="mt-8 text-center">
        <button type="button" onClick={() => go("welcome")} className="text-sm text-[var(--tb-accent)]">
          ← Back to the start
        </button>
      </div>
    </div>
  );
}
