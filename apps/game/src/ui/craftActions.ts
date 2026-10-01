import { api } from "../api";
import { refreshCharacter } from "../game/flow";
import { getState, toast } from "../state/store";
import { LEVEL_CAP, levelForXp, xpRequired } from "@ender/domain";
import { boardRadius, capacityForRank } from "@ender/battle";
import { qualityName } from "../economy/format";

const DOMAIN_NAMES: Record<string, string> = { discovery: "Discovery", craft: "Craft", proof: "Proof", prophecy: "Prophecy", efficiency: "Efficiency", commerce: "Commerce" };

/** Shared feedback for any action that may grant XP or Mastery. */
export function announceProgress(out: any) {
  if (out?.inference) {
    const gained = out.inference.xp ?? 0;
    // XP is Loom Rank progress, so say so, and say what a new Rank gives (room on the Loom).
    const before = getState().character?.xp ?? 0;
    const after = before + gained;
    const rank = levelForXp(after);
    if (out.inference.levelsGained > 0) toast(rankUpText(rank - out.inference.levelsGained, rank), "mastery");
    else if (gained > 0 && rank < LEVEL_CAP) toast(`+${gained} toward Loom Rank ${rank + 1} (${after - xpRequired(rank)}/${xpRequired(rank + 1) - xpRequired(rank)})`, "gain");
    else if (out.inference.repeated) toast("No new insight: the Familiar has done this work before", "info");
  }
  for (const m of out?.mastery ?? []) {
    const name = DOMAIN_NAMES[m.domain] ?? m.domain;
    if (m.success >= 0.99) toast(`${name} Mastery ↑ (${m.before} → ${m.after})`, "mastery");
    else if (m.success <= 0.01) toast(`${name}: that choice did not pan out`, "loss");
    else toast(`${name} Mastery ${m.after >= m.before ? "↑" : "↓"} (calibration ${Math.round(m.success * 100)}%)`, "mastery");
  }
}

/** What reaching a new Loom Rank gives, in plain words. */
function rankUpText(from: number, to: number) {
  const more = capacityForRank(to) - capacityForRank(from);
  const ring = boardRadius(to) > boardRadius(from);
  const gift = ring ? ": the outer ring opens" : more > 0 ? `: your Loom holds ${capacityForRank(to)} now` : "";
  return `Loom Rank ${to}${gift}!`;
}

export async function doAttune(id: string) {
  const out = await api.attune(id);
  announceProgress(out);
  await refreshCharacter();
  return out;
}

export function describeObservation(o: { quality: string; significance: string; text: string }) {
  return `${qualityName(o.quality)} — ${o.text}`;
}
