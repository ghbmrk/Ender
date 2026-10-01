import { AFFINITIES, compileLoom, type Affinity, type BattleSetup, type LoomNode, type Role } from "@ender/battle";

/** A fixed practice party for ?demo=battle (developer preview and screenshots; never used by normal play). */
const n = (id: string, role: Role, q: number, r: number, a: [Affinity, Affinity], score = 70, evidence: LoomNode["evidence"] = "trialed"): LoomNode => ({
  id,
  formId: id,
  name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  role,
  q,
  r,
  affinities: a,
  technicalScore: score,
  evidence,
});

export const DEMO_LOOMS: Record<string, LoomNode[]> = {
  iron: [n("slab-of-ash", "action", 1, 0, ["burden", "knots"], 72), n("knotwork-lattice", "action", 1, -1, ["knots", "burden"], 66), n("iron-veil", "reaction", 0, 1, ["burden", "veil"], 60), n("ash-brace", "modifier", 2, -1, ["knots", "bond"], 58)],
  bond: [n("ember-thread", "action", 0, -1, ["bond", "flex"], 70), n("hearth-salt", "reaction", -1, 0, ["bond", "reach"], 62), n("tidal-glass", "action", -1, 1, ["reach", "bond"], 64)],
  quick: [n("storm-lattice", "action", 1, 0, ["flex", "reach"], 74), n("veiled-edge", "action", 0, 1, ["veil", "flex"], 61), n("quickglass", "modifier", 1, 1, ["flex", "veil"], 55)],
};

import { DUEL_FIELD_CAP, DUEL_HP } from "./hero";

export function demoSetup(boss = false): BattleSetup {
  return {
    seed: `demo|${Date.now()}`,
    // Demos match the game: one hero, foes stepping up one at a time.
    party: (["quick"] as const).map((root) => ({ root, loom: compileLoom(DEMO_LOOMS[root]!, 9) })),
    waves: boss ? [["king"]] : [["husk"], ["wisp"], ["hound"], ["keeper"]],
    difficulty: 1,
    fieldCap: DUEL_FIELD_CAP,
    foeScale: { hp: DUEL_HP[boss ? "boss" : "normal"] },
  };
}
export { AFFINITIES };
