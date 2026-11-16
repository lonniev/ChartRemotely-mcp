/** Every tool, what it does and its live fare: the fleet's price sheet, on the desk's palette. */

import { PriceSheet } from "@tollbooth-dpyc/web/react";
import { go } from "../lib/route";
import { useT } from "../i18n";

export default function Prices() {
  const t = useT();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PriceSheet />
      <div className="mt-8 text-center">
        <button type="button" onClick={() => go("welcome")} className="text-sm text-[var(--tb-accent)]">
          {t("ui.app.back")}
        </button>
      </div>
    </div>
  );
}
