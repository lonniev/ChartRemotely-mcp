/**
 * A Material 3 style carousel: rounded slides that snap to centre, with the
 * neighbours peeking in smaller at the edges.
 *
 * Built on CSS scroll-snap, so swipe, trackpad and wheel scrolling come from
 * the browser. Arrow keys and the dots move one slide at a time, and a tap on
 * a neighbour brings it to the centre rather than acting on it.
 *
 * ``onSettle`` hears which slide is centred once scrolling has stopped - not
 * every slide a swipe passes over - so a caller can load what is in view and
 * nothing it flew past. ``index`` moves the carousel from outside, e.g. to
 * keep the same item centred when the list reorders under it, and is stood on
 * before the first measurement, so a carousel that mounts on its fifth slide
 * never reports its first.
 *
 * The ``full`` size fills whatever holds it, one slide at a time: a picture
 * full screen, swiped through with the same gesture as the page beneath.
 */

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { wrapIndex } from "../lib/screens";

/** How long scrolling must pause before the centred slide counts as chosen. */
const SETTLE_MS = 220;

const SIZES = {
  /** One big slide: a picture. */
  wide: { root: "", slide: "w-[82cqw] md:w-[62cqw]", track: "gap-3 py-2 px-[9cqw] md:px-[19cqw]" },
  /** Several small cards in view at once: a symbol. */
  card: { root: "", slide: "w-[40cqw] md:w-[22cqw]", track: "gap-3 py-2 px-[30cqw] md:px-[39cqw]" },
  /** The whole container, one slide at a time: a picture full screen. */
  full: { root: "h-full min-h-0", slide: "h-full w-[100cqw]", track: "h-full" },
} as const;

interface Props {
  children: ReactNode;
  label: string;
  /** What one slide is, for the buttons' names: "screen", "symbol", "capture". */
  itemName?: string;
  size?: keyof typeof SIZES;
  index?: number;
  onSettle?: (index: number) => void;
  /** The dots under the track; off when there are too many slides to count. */
  dots?: boolean;
  /** Focus the track on mount, so arrow keys work at once (a dialog). */
  autoFocus?: boolean;
}

export default function Carousel({
  children,
  label,
  itemName = "screen",
  size = "wide",
  index,
  onSettle,
  dots = true,
  autoFocus = false,
}: Props) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const settleRef = useRef(onSettle);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  settleRef.current = onSettle;
  const sized = SIZES[size];

  // The slide whose centre is nearest the track's centre is the active one.
  // Measured on scroll rather than by an intersection threshold, which marks
  // two slides at once whenever the neighbours are wide enough to pass it.
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const mid = el.getBoundingClientRect().left + el.clientWidth / 2;
    let best = 0;
    let bestGap = Infinity;
    el.querySelectorAll<HTMLElement>("[data-index]").forEach((s) => {
      const r = s.getBoundingClientRect();
      const gap = Math.abs(r.left + r.width / 2 - mid);
      if (gap < bestGap) {
        bestGap = gap;
        best = Number(s.dataset.index);
      }
    });
    activeRef.current = best;
    setActive(best);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => settleRef.current?.(activeRef.current), SETTLE_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const goTo = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = track.current?.querySelector<HTMLElement>(`[data-index="${wrapIndex(i, slides.length)}"]`);
      const box = track.current;
      if (!el || !box) return;
      // Scroll the track only - scrollIntoView would also move the page.
      const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
      box.scrollTo({ left, behavior });
    },
    [slides.length],
  );

  // Moved from outside (or mounted on a slide): jump, so no slide in between
  // is passed over, then measure at once. An instant scroll lands before the
  // measurement reads the rects, so the slide reported is the one asked for,
  // never a default first. Declared before the mount measurement below so it
  // runs first.
  useEffect(() => {
    if (index === undefined || index === activeRef.current) return;
    goTo(index, "instant");
    measure();
  }, [index, goTo, measure]);

  useEffect(measure, [measure, slides.length]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={`@container relative ${sized.root}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(active + 1);
        if (e.key === "ArrowLeft") goTo(active - 1);
      }}
    >
      <div
        ref={track}
        tabIndex={0}
        autoFocus={autoFocus}
        onScroll={measure}
        className={`no-scrollbar relative flex snap-x snap-mandatory overflow-x-auto outline-none ${sized.track}`}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            data-index={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            onClickCapture={(e) => {
              if (i === active) return;
              e.preventDefault();
              e.stopPropagation();
              goTo(i);
            }}
            className={`flex-none snap-center transition-[transform,opacity] duration-300 ${sized.slide} ${
              i === active ? "scale-100 opacity-100" : "scale-[0.92] opacity-60"
            }`}
          >
            {slide}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label={`Previous ${itemName}`}
            className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--tb-surface-2)]/90 md:flex"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label={`Next ${itemName}`}
            className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--tb-surface-2)]/90 md:flex"
          >
            <ChevronRight size={20} />
          </button>
          {dots && (
          <div className="mt-2 flex justify-center">
            {slides.map((_, i) => (
              // The dot is small; the button around it is a full-size target.
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to ${itemName} ${i + 1}`}
                aria-current={i === active}
                className="flex h-10 min-w-7 items-center justify-center"
              >
                <span
                  className={`h-2 rounded-full transition-all ${
                    i === active ? "w-6 bg-[var(--tb-accent)]" : "w-2 bg-[var(--tb-line)]"
                  }`}
                />
              </button>
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}
