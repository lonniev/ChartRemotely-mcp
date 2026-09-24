/** Hash routes: static hosting needs no rewrite rules, and a reload lands where it was. */

import { useEffect, useState } from "react";

export type View = "welcome" | "how" | "start" | "save-key" | "signin" | "screens" | "profile";

const VIEWS: View[] = ["welcome", "how", "start", "save-key", "signin", "screens", "profile"];

/** The hash after "#/", split into the view and its query ("save-key?npub=…"). */
function parts(): [string, URLSearchParams] {
  const [v, q = ""] = globalThis.location.hash.replace(/^#\/?/, "").split("?", 2);
  return [v, new URLSearchParams(q)];
}

function current(): View {
  const v = parts()[0] as View;
  return VIEWS.includes(v) ? v : "welcome";
}

/** A query value on the current route, e.g. the npub setup passes to #/save-key. */
export function routeParam(name: string): string {
  return parts()[1].get(name) ?? "";
}

export function go(view: View): void {
  globalThis.location.hash = `/${view}`;
  globalThis.scrollTo?.(0, 0);
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
