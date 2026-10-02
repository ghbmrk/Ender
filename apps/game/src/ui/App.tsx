import { sfx } from "./battle/sfx";
import { useEffect, useMemo, useState } from "react";
import { ArtDefs } from "../art/defs";
import { battleSetup, endBattle } from "../game/flow";
import { demoSetup } from "../game/demo";
import { LESSONS, leavePractice, lessonEnded, lessonSetup, skipTutorial } from "../game/tutorial";
import { getState, setState, toast, useStore } from "../state/store";
import { enterGame } from "../game/launch";
import { Stage } from "./Stage";
import { Title } from "./Title";
import { Landing } from "./Landing";
import { Toasts } from "./Toasts";
import { RealmGate } from "./RealmGate";
import { Crucible } from "./Crucible";
import { Bazaar } from "./Bazaar";
import { Grimoire } from "./Grimoire";
import { Inventory } from "./Inventory";
import { Provenance } from "./Provenance";
import { RunSummary } from "./RunSummary";
import { FamiliarAway } from "./Familiar";
import { Rewards, SpoilsStrip } from "./Rewards";
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
  const practice = useStore((s) => !!s.practice);
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
      onSkip={practice ? leavePractice : () => skipTutorial().catch((e) => toast((e as Error).message, "loss"))}
      practice={practice}
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
    if (panel) sfx.open();
  }, [panel]);
  useEffect(() => {
    if (DEMO) setState({ screen: DEMO === "loom" ? "loom" : "battle" });
    else if (getState().screen === "boot") void enterGame();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState((s) => (s.panel === "summary" ? {} : { panel: null }));
    };
    window.addEventListener("keydown", onKey);
    // Every button outside a fight answers with a soft tap; fights have their own sounds.
    const onTap = (e: PointerEvent) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (b && !(b as HTMLButtonElement).disabled && !b.closest(".battle")) sfx.tap();
    };
    document.addEventListener("pointerdown", onTap);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onTap);
    };
  }, []);

  return (
    <div className="app">
      <ArtDefs />
      <Stage>
        {screen === "boot" && <div className="boot" data-testid="boot" />}
        {screen === "landing" && <Landing />}
        {screen === "title" && <Title />}
        {screen === "create" && <CreateHero />}
        {screen === "crossing" && <Crossing />}
        {screen === "map" && <MapScreen />}
        {screen === "map" && <SpoilsStrip />}
        {screen === "battle" && <BattleHost />}
        {screen === "loom" && <LoomScreen />}
        {screen === "crossing" && <LoomWarm />}
      </Stage>
      {panel === "gate" && <RealmGate />}
      {panel === "crucible" && <Crucible />}
      {panel === "bazaar" && <Bazaar />}
      {panel === "grimoire" && <Grimoire />}
      {panel === "inventory" && <Inventory />}
      {panel === "provenance" && <Provenance />}
      {panel === "rewards" && <Rewards />}
      {panel === "summary" && <RunSummary />}
      {panel === "familiar" && <FamiliarAway />}
      <Toasts />
    </div>
  );
}

/** The Loom's first opening paid for its code and text layout on the tap; this lays it out once, unseen, while the
 * player looks at the Crossing, then lets it go, so the real first visit opens as fast as a second one. */
let loomWarmed = false;
function LoomWarm() {
  const [on, setOn] = useState(false);
  const lesson = useStore((s) => !!s.tutorial);
  const ready = useStore((s) => !!s.loom);
  useEffect(() => {
    if (loomWarmed || lesson || !ready) return;
    const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300));
    const cancel = (window as any).cancelIdleCallback ?? clearTimeout;
    const id = idle(() => {
      loomWarmed = true;
      setOn(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setOn(false)));
    }, { timeout: 1500 });
    return () => cancel(id);
  }, [lesson, ready]);
  return on ? (
    <div className="loom-warm" aria-hidden>
      <LoomScreen ghost />
    </div>
  ) : null;
}
