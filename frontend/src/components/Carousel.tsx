/**
 * A Material 3 style carousel: large rounded slides that snap to centre, with
 * the neighbours peeking in smaller at the edges.
 *
 * Built on CSS scroll-snap, so swipe, trackpad and wheel scrolling come from
 * the browser. Arrow keys and the dots move one slide at a time.
 */

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { wrapIndex } from "../lib/screens";

export default function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

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
    setActive(best);
  }, []);

  useEffect(measure, [measure, slides.length]);

  const goTo = useCallback(
    (i: number) => {
      const el = track.current?.querySelector<HTMLElement>(`[data-index="${wrapIndex(i, slides.length)}"]`);
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    },
    [slides.length],
  );

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="@container relative"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(active + 1);
        if (e.key === "ArrowLeft") goTo(active - 1);
      }}
    >
      <div
        ref={track}
        tabIndex={0}
        onScroll={measure}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[9cqw] py-2 outline-none md:px-[19cqw]"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            data-index={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className={`w-[82cqw] flex-none snap-center transition-[transform,opacity] duration-300 md:w-[62cqw] ${
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
            aria-label="Previous screen"
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-[var(--tb-surface-2)]/90 p-2 md:block"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Next screen"
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-[var(--tb-surface-2)]/90 p-2 md:block"
          >
            <ChevronRight size={20} />
          </button>
          <div className="mt-3 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to screen ${i + 1}`}
                aria-current={i === active}
                className={`h-2 rounded-full transition-all ${
                  i === active ? "w-6 bg-[var(--tb-accent)]" : "w-2 bg-[var(--tb-line)]"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
