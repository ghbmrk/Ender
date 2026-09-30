import { api } from "../api";
import { bus } from "../state/bus";
import { getState, setState, toast } from "../state/store";
import { goToCrossing, goToRealm } from "./createGame";

export async function refreshCharacter() {
  const character = await api.character();
  setState({ character });
  return character;
}

export async function refreshWorld() {
  const world = await api.world();
  setState({ world });
  return world;
}

export async function newBinder(preset?: string) {
  await api.reset(preset ? { preset } : {});
  await Promise.all([refreshCharacter(), refreshWorld()]);
  setState({ screen: "crossing", panel: null, run: null });
  goToCrossing();
  toast("A new Binder steps into the Crossing. Visit the Bazaar, then the Realm Gate.", "info");
}

export async function continueGame() {
  await Promise.all([refreshCharacter(), refreshWorld()]);
  setState({ screen: "crossing", panel: null });
  goToCrossing();
}

let clearedRooms: number[] = [];

export async function enterRealm(realmId: string) {
  const out = await api.startRun(realmId);
  clearedRooms = [];
  if (out.focusConverted) toast(`Unspent Focus became ${out.focusConverted} Crowns`, "gain");
  setState({ run: out.plan, screen: "realm", panel: null });
  await refreshCharacter();
  goToRealm({ plan: out.plan, stats: { ...out.stats } });
}

export function installFlowListeners() {
  bus.on("station:open", ({ station }) => {
    const map = { gate: "gate", bazaar: "bazaar", crucible: "crucible", mirror: "crucible", grimoire: "grimoire", passives: "passives" } as const;
    setState({ panel: map[station], crucibleMode: station === "mirror" ? "mirror" : "craft" });
  });
  bus.on("run:room-cleared", ({ roomIndex }) => {
    if (!clearedRooms.includes(roomIndex)) clearedRooms.push(roomIndex);
  });
  bus.on("run:shrine", async () => {
    const run = getState().run;
    if (!run) return;
    try {
      const cp = await api.checkpoint(run.runId, clearedRooms.filter((r) => r < 5));
      await refreshCharacter();
      setState({ panel: "shrine", shrineForms: cp.artifacts } as any);
    } catch (e) {
      toast((e as Error).message, "loss");
    }
  });
  bus.on("run:ended", async (r) => {
    const run = getState().run;
    if (!run) return;
    try {
      const out = await api.completeRun(run.runId, r);
      await Promise.all([refreshCharacter(), refreshWorld()]);
      setState({ runSummary: { ...out, combat: r, realmId: run.realmId }, panel: "summary", run: null });
    } catch (e) {
      toast((e as Error).message, "loss");
    }
  });
  bus.on("run:pickup", (p) => {
    if (p.kind === "form") toast("A Veiled Form — its nature is hidden", "info");
  });
}

export function returnToCrossing() {
  setState({ screen: "crossing", panel: null, runSummary: null });
  goToCrossing();
}
