import { useEffect } from "react";
import { MonitorPlay } from "lucide-react";
import { avatarFor } from "@tollbooth-dpyc/web";
import { Avatar, NpubGate, useSession } from "@tollbooth-dpyc/web/react";
import { go, useView } from "./lib/route";
import Profile from "./views/Profile";
import Screens from "./views/Screens";
import Welcome from "./views/Welcome";

export default function App() {
  const session = useSession();
  const view = useView();

  // Pages that need a session send a stranger to sign in; a lapsed proof does
  // too. Someone already signed in who lands on sign-in goes to their screens.
  const needsSession = view === "screens" || view === "profile";
  useEffect(() => {
    if (needsSession && !session.signedIn) go("signin");
    if (view === "signin" && session.signedIn) go("screens");
  }, [needsSession, view, session.signedIn]);

  return (
    <div className="min-h-dvh">
      <nav className="sticky top-0 z-40 flex items-center gap-2 border-b border-[var(--tb-line)] bg-[#0b0d10]/90 px-4 py-2.5 backdrop-blur">
        <button type="button" onClick={() => go("welcome")} className="mr-auto font-semibold tracking-tight">
          Chart<span className="text-[var(--tb-accent)]">Remotely</span>
        </button>
        {session.signedIn ? (
          <>
            <button
              type="button"
              onClick={() => go("screens")}
              aria-label="Screens"
              aria-current={view === "screens"}
              className={`rounded-full p-2 ${view === "screens" ? "text-[var(--tb-accent)]" : "text-[var(--tb-muted)]"}`}
            >
              <MonitorPlay size={22} />
            </button>
            <button type="button" onClick={() => go("profile")} aria-label="Profile" aria-current={view === "profile"}>
              <Avatar value={avatarFor(session.npub)} size={32} />
            </button>
          </>
        ) : (
          view !== "signin" && (
            <button type="button" onClick={() => go("signin")} className="rounded-full px-3 py-1.5 text-sm">
              Sign in
            </button>
          )
        )}
      </nav>

      <main>
        {view === "welcome" && <Welcome signedIn={session.signedIn} />}
        {view === "signin" && (
          <NpubGate
            notice={session.notice || undefined}
            onLogin={() => {
              session.refresh();
              go("screens");
            }}
          />
        )}
        {view === "screens" && session.signedIn && <Screens />}
        {view === "profile" && session.signedIn && <Profile session={session} />}
      </main>
    </div>
  );
}
