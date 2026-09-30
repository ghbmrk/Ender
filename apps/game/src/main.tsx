import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { debug } from "./game/debug";
import { getState, setState } from "./state/store";
import { api } from "./api";
import "./styles.css";

// Developer / test surface. Gameplay never depends on it.
(window as any).__weave = { debug, getState, setState, api };

async function boot() {
  // The web build carries its own server; the dev build talks to apps/server over /api.
  if (import.meta.env.MODE === "web") await (await import("./standalone/install")).installInPageServer();
  createRoot(document.getElementById("root")!).render(<App />);
}
void boot();
