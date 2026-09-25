/**
 * Something to read while a screen's picture is on its way: lines about
 * trading, each with a traceable source. Proverbs are credited as proverbs.
 * Local only — no remote corpus.
 */

import type { Quote } from "@tollbooth-dpyc/web";

export const TRADING_QUOTES: ReadonlyArray<Quote> = [
  {
    text: "There is nothing new in Wall Street. There can't be because speculation is as old as the hills.",
    author: "Edwin Lefèvre, Reminiscences of a Stock Operator (1923)",
  },
  {
    text: "It never was my thinking that made the big money for me. It always was my sitting.",
    author: "Edwin Lefèvre, Reminiscences of a Stock Operator (1923)",
  },
  {
    text: "The individual investor should act consistently as an investor and not as a speculator.",
    author: "Benjamin Graham, The Intelligent Investor",
  },
  {
    text: "In the short run, the market is a voting machine but in the long run it is a weighing machine.",
    author: "Benjamin Graham, as quoted by Warren Buffett in his letters to shareholders",
  },
  {
    text: "We simply attempt to be fearful when others are greedy and to be greedy only when others are fearful.",
    author: "Warren Buffett, Berkshire Hathaway letter (1986)",
  },
  {
    text: "Price is what you pay; value is what you get.",
    author: "Warren Buffett, Berkshire Hathaway letter (2008)",
  },
  {
    text: "Bull markets are born on pessimism, grow on skepticism, mature on optimism, and die on euphoria.",
    author: "Sir John Templeton",
  },
  {
    text: "The trend is your friend.",
    author: "Wall Street proverb",
  },
  {
    text: "Plan your trade, and trade your plan.",
    author: "Trading-floor proverb",
  },
  {
    text: "Buy the rumor, sell the news.",
    author: "Wall Street proverb",
  },
];
