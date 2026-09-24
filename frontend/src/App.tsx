import { useEffect } from "react";
import { MonitorPlay } from "lucide-react";
import { avatarFor } from "@tollbooth-dpyc/web";
import { Avatar, NpubGate, useSession } from "@tollbooth-dpyc/web/react";
import { go, useView } from "./lib/route";
import Profile from "./views/Profile";
import Screens from "./views/Screens";
import HowItWorks from "./views/HowItWorks";
import SaveKey from "./views/SaveKey";
import Start from "./views/Start";
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
      {/* Three columns so the centre action is centred on the page, not on the gap. */}
      <nav className="sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--tb-line)] bg-[#0b0d10]/90 px-4 py-2.5 backdrop-blur">
        <button type="button" onClick={() => go("welcome")} className="justify-self-start font-semibold tracking-tight">
          Chart<span className="text-[var(--tb-accent)]">Remotely</span>
        </button>
        {session.signedIn ? (
          <>
            <button
              type="button"
              onClick={() => go("screens")}
              aria-label="My screens"
              aria-current={view === "screens"}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium sm:px-4 ${
                view === "screens"
                  ? "border-[var(--tb-accent)] bg-[var(--tb-accent)] text-[var(--tb-on-accent)]"
                  : "border-[var(--tb-line)] bg-[var(--tb-surface-2)] text-[var(--tb-accent)]"
              }`}
            >
              <MonitorPlay size={22} aria-hidden="true" />
              <span className="hidden text-sm sm:inline">My screens</span>
            </button>
            <button
              type="button"
              onClick={() => go("profile")}
              aria-label="Profile"
              aria-current={view === "profile"}
              className="justify-self-end"
            >
              <Avatar value={avatarFor(session.npub)} size={32} />
            </button>
          </>
        ) : (
          <div className="col-start-3 flex items-center justify-self-end">
            {view !== "start" && (
              <button type="button" onClick={() => go("start")} className="rounded-full px-3 py-1.5 text-sm text-[var(--tb-accent)]">
                Get started
              </button>
            )}
            {view !== "signin" && (
              <button type="button" onClick={() => go("signin")} className="rounded-full px-3 py-1.5 text-sm">
                Sign in
              </button>
            )}
          </div>
        )}
      </nav>

      <main>
        {view === "welcome" && <Welcome signedIn={session.signedIn} />}
        {view === "how" && <HowItWorks />}
        {view === "start" && <Start />}
        {view === "save-key" && <SaveKey session={session} />}
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
