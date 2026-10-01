import { useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { toast, useStore } from "./state/store";
import { markFailed, markReady } from "./ready";
import { Stage } from "./ui/Stage";
import { Landing } from "./ui/Landing";
import { Toasts } from "./ui/Toasts";
// Screen stylesheets first, then the shared ones that refine them (the order they had before the split start).
// They load with the first part: the single-file build dropped them when only lazy screens imported them.
import "./coach.css";
import "./create.css";
import "./styles.css";
import "./frame.css";
import "./painted.css";
import "./motion.css";
import "./blind.css";

/**
 * Two-part start: the title shows as soon as this small first part runs, while the rest of the game (the in-page
 * server with its seeds, and every other screen) loads behind it. Signing in waits for the rest only if it isn't in yet.
 */
let App: ComponentType | null = null;
const rest = (async () => {
  // The web build carries its own server; the dev build talks to apps/server over /api.
  if (import.meta.env.MODE === "web" || import.meta.env.MODE === "split") await (await import("./standalone/install")).installInPageServer();
  const [app, { debug }, { api }, store] = await Promise.all([import("./ui/App"), import("./game/debug"), import("./api"), import("./state/store")]);
  // Developer / test surface. Gameplay never depends on it.
  (window as any).__ender = { debug, getState: store.getState, setState: store.setState, api };
  App = app.App;
  markReady();
  if ((window as { __enderNoSave?: boolean }).__enderNoSave) toast("Your save couldn't be read in this browser just now, so this session won't be saved. Reload to try again.", "loss");
})().catch((e) => {
  markFailed(e);
  document.getElementById("root")!.textContent = `Ender couldn't start: ${(e as Error).message}`;
});

function Boot() {
  const screen = useStore((s) => s.screen);
  const [, setLoaded] = useState(false);
  useEffect(() => {
    void rest.then(() => setLoaded(true));
  }, []);
  if (App) return <App />;
  // Before the rest is in: the title for someone who hasn't signed in, else the loading screen.
  if (screen === "landing")
    return (
      <div className="app">
        <Stage>
          <Landing />
        </Stage>
        <Toasts />
      </div>
    );
  return <div className="boot-loading">LOADING ENDER</div>;
}

createRoot(document.getElementById("root")!).render(<Boot />);
