/**
 * How this site draws a QuoteScroller. The package keeps the mechanics (the
 * rotation, the fade, the reserved height); the look is ours, and lives here.
 */

import type { QuoteScrollerClassNames } from "@tollbooth-dpyc/web/react";

/** The loading page: centred, a green tracked heading, a serif italic quote. */
export const quoteStyles: QuoteScrollerClassNames = {
  root: "px-4 py-6 text-center",
  heading:
    "mb-5 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--tb-accent)]",
  spinner: "h-3.5 w-3.5",
  figure: "m-0 mx-auto flex max-w-xl flex-col justify-center gap-3",
  text: "m-0 font-serif text-[17px] italic leading-relaxed text-[var(--tb-ink)]",
  mark: "not-italic text-[var(--tb-accent)]",
  author: "font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--tb-muted)]",
};

/** Inside a picture's box: the same look, tighter on a phone so it fits. */
export const pictureQuoteStyles: QuoteScrollerClassNames = {
  ...quoteStyles,
  root: `${quoteStyles.root} w-full max-sm:px-3 max-sm:py-2`,
  heading: `${quoteStyles.heading} max-sm:mb-2`,
  text: `${quoteStyles.text} max-sm:text-[14px] max-sm:leading-snug`,
};
