import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { debug } from "./game/debug";
import { getState, setState, toast } from "./state/store";
import { api } from "./api";
import "./styles.css";
import "./frame.css";
import "./painted.css";
import "./motion.css";

// Developer / test surface. Gameplay never depends on it.
(window as any).__ender = { debug, getState, setState, api };

async function boot() {
  // The web build carries its own server; the dev build talks to apps/server over /api.
  if (import.meta.env.MODE === "web") {
    try {
      await (await import("./standalone/install")).installInPageServer();
    } catch (e) {
      document.getElementById("root")!.textContent = `Ender couldn't start: ${(e as Error).message}`;
      return;
    }
  }
  createRoot(document.getElementById("root")!).render(<App />);
  if ((window as { __enderNoSave?: boolean }).__enderNoSave) toast("Your save couldn't be read in this browser just now, so this session won't be saved. Reload to try again.", "loss");
}
void boot();
