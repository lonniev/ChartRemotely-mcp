/**
 * Something to read while a screen's picture is on its way: lines about
 * trading, each with a traceable source. Proverbs are credited as proverbs.
 * Local only — no remote corpus. The words are in the i18n catalog
 * (`lib.quotes.N`), so each line reads in the reader's language.
 */

import type { Quote } from "@tollbooth-dpyc/web";
import { tr } from "../i18n/index.ts";
import type { MessageKey } from "../i18n/en.ts";

const COUNT = 10;

/** The quotes in the language on screen now. Call at render time. */
export function tradingQuotes(): ReadonlyArray<Quote> {
  return Array.from({ length: COUNT }, (_, i) => ({
    text: tr(`lib.quotes.${i}.text` as MessageKey),
    author: tr(`lib.quotes.${i}.author` as MessageKey),
  }));
}
