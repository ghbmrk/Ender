import { useEffect, useMemo } from "react";
import { ArtDefs } from "../art/defs";
import { battleSetup, endBattle } from "../game/flow";
import { demoSetup } from "../game/demo";
import { setState, toast, useStore } from "../state/store";
import { Stage } from "./Stage";
import { Title } from "./Title";
import { Toasts } from "./Toasts";
import { RealmGate } from "./RealmGate";
import { Crucible } from "./Crucible";
import { Bazaar } from "./Bazaar";
import { Grimoire } from "./Grimoire";
import { Inventory } from "./Inventory";
import { Provenance } from "./Provenance";
import { RunSummary } from "./RunSummary";
import { Rewards } from "./Rewards";
import { BattleScreen } from "./battle/BattleScreen";
import { Crossing } from "./scenes/Crossing";
import { MapScreen } from "./scenes/MapScreen";
import { LoomScreen } from "./loom/LoomScreen";

const params = new URLSearchParams(location.search);
const DEMO = params.get("demo");

function BattleHost() {
  const b = useStore((s) => s.battle);
  const ex = useStore((s) => s.expedition);
  const setup = useMemo(() => (DEMO ? demoSetup(DEMO === "boss") : b && ex ? battleSetup() : null), [b?.nodeId]);
  if (DEMO && setup) return <BattleScreen setup={setup} realmId="glass-fen" boss={DEMO === "boss"} onEnd={() => location.reload()} />;
  if (!b || !ex || !setup) return null;
  return (
    <BattleScreen
      key={b.nodeId}
      setup={setup}
      realmId={ex.plan.realmId}
      boss={b.kind === "boss"}
      onEnd={(r) => endBattle(r).catch((e) => toast((e as Error).message, "loss"))}
    />
  );
}

export function App() {
  const screen = useStore((s) => s.screen);
  const panel = useStore((s) => s.panel);
  useEffect(() => {
    if (DEMO) setState({ screen: DEMO === "loom" ? "loom" : "battle" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState((s) => (s.panel === "summary" ? {} : { panel: null }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <ArtDefs />
      <Stage>
        {screen === "title" && <Title />}
        {screen === "crossing" && <Crossing />}
        {screen === "map" && <MapScreen />}
        {screen === "battle" && <BattleHost />}
        {screen === "loom" && <LoomScreen />}
      </Stage>
      {panel === "gate" && <RealmGate />}
      {panel === "crucible" && <Crucible />}
      {panel === "bazaar" && <Bazaar />}
      {panel === "grimoire" && <Grimoire />}
      {panel === "inventory" && <Inventory />}
      {panel === "provenance" && <Provenance />}
      {panel === "rewards" && <Rewards />}
      {panel === "summary" && <RunSummary />}
      <Toasts />
    </div>
  );
}
