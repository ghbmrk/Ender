import { useEffect, useMemo } from "react";
import { ArtDefs } from "../art/defs";
import { battleSetup, endBattle } from "../game/flow";
import { demoSetup } from "../game/demo";
import { LESSONS, lessonEnded, lessonSetup, skipTutorial } from "../game/tutorial";
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
import { CreateHero } from "./scenes/CreateHero";

const params = new URLSearchParams(location.search);
const DEMO = params.get("demo");

/** A prologue practice fight: one lesson, retried on a loss. */
function LessonHost() {
  const step = useStore((s) => s.tutorial);
  const run = useStore((s) => s.tutorialRun);
  const lesson = step && step in LESSONS ? LESSONS[step as keyof typeof LESSONS] : null;
  const setup = useMemo(() => (lesson ? lessonSetup(lesson) : null), [step, run]);
  if (!lesson || !setup) return null;
  return (
    <BattleScreen
      key={`${step}-${run}`}
      setup={setup}
      realmId={step === "skill" ? "hollow-keep" : "ashen-vault"}
      boss={false}
      title={lesson.title}
      lesson={lesson}
      onSkip={() => skipTutorial().catch((e) => toast((e as Error).message, "loss"))}
      onEnd={(r) => lessonEnded(lesson.step, r.outcome === "victory")}
    />
  );
}

function BattleHost() {
  const tutorial = useStore((s) => s.tutorial);
  if (tutorial && !DEMO) return <LessonHost />;
  return <RunBattleHost />;
}

function RunBattleHost() {
  const b = useStore((s) => s.battle);
  const ex = useStore((s) => s.expedition);
  const setup = useMemo(() => (DEMO ? demoSetup(DEMO === "boss", DEMO) : b && ex ? battleSetup() : null), [b?.nodeId]);
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
        {screen === "create" && <CreateHero />}
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
