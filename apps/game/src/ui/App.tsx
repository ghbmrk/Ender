import { useEffect, useRef } from "react";
import { createGame } from "../game/createGame";
import { installFlowListeners } from "../game/flow";
import { setState, useStore } from "../state/store";
import { Title } from "./Title";
import { Hud } from "./Hud";
import { Toasts } from "./Toasts";
import { RealmGate } from "./RealmGate";
import { Crucible } from "./Crucible";
import { Bazaar } from "./Bazaar";
import { Grimoire } from "./Grimoire";
import { PassiveTree } from "./PassiveTree";
import { Inventory } from "./Inventory";
import { Provenance } from "./Provenance";
import { Shrine } from "./Shrine";
import { RunSummary } from "./RunSummary";

let installed = false;

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const screen = useStore((s) => s.screen);
  const panel = useStore((s) => s.panel);

  useEffect(() => {
    if (!installed) {
      installed = true;
      installFlowListeners();
    }
    if (host.current) (window as any).__ender.game = createGame(host.current);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) return;
      if (e.key === "Tab") {
        e.preventDefault();
        setState((s) => (s.screen === "title" ? {} : { panel: s.panel === "inventory" ? null : s.panel === null ? "inventory" : s.panel }));
      } else if (e.key === "Escape") setState((s) => (s.panel === "summary" ? {} : { panel: null }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <div ref={host} className="canvas-host" data-testid="game-canvas" />
      {screen === "title" && <Title />}
      {screen !== "title" && <Hud />}
      {panel === "gate" && <RealmGate />}
      {panel === "crucible" && <Crucible />}
      {panel === "bazaar" && <Bazaar />}
      {panel === "grimoire" && <Grimoire />}
      {panel === "passives" && <PassiveTree />}
      {panel === "inventory" && <Inventory />}
      {panel === "provenance" && <Provenance />}
      {panel === "shrine" && <Shrine />}
      {panel === "summary" && <RunSummary />}
      <Toasts />
    </div>
  );
}
