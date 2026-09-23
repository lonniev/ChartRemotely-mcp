/** Hash routes: static hosting needs no rewrite rules, and a reload lands where it was. */

import { useEffect, useState } from "react";

export type View = "welcome" | "signin" | "screens" | "profile";

const VIEWS: View[] = ["welcome", "signin", "screens", "profile"];

function current(): View {
  const v = globalThis.location.hash.replace(/^#\/?/, "") as View;
  return VIEWS.includes(v) ? v : "welcome";
}

export function go(view: View): void {
  globalThis.location.hash = `/${view}`;
}

export function useView(): View {
  const [view, setView] = useState(current);
  useEffect(() => {
    const on = () => setView(current());
    globalThis.addEventListener("hashchange", on);
    return () => globalThis.removeEventListener("hashchange", on);
  }, []);
  return view;
}
