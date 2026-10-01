import { api } from "../api";
import { refreshCharacter } from "../game/flow";
import { toast } from "../state/store";
import { qualityName } from "../economy/format";

const DOMAIN_NAMES: Record<string, string> = { discovery: "Discovery", craft: "Craft", proof: "Proof", prophecy: "Prophecy", efficiency: "Efficiency", commerce: "Commerce" };

/** Shared feedback for any action that may grant XP or Mastery. */
export function announceProgress(out: any) {
  if (out?.inference) {
    if (out.inference.xp > 0) toast(`+${out.inference.xp} Attunement XP`, "gain");
    else if (out.inference.repeated) toast("No new insight: the Familiar has done this work before", "info");
    if (out.inference.levelsGained > 0) toast(`Level up! +${out.inference.levelsGained} passive point`, "mastery");
  }
  for (const m of out?.mastery ?? []) {
    const name = DOMAIN_NAMES[m.domain] ?? m.domain;
    if (m.success >= 0.99) toast(`${name} Mastery ↑ (${m.before} → ${m.after})`, "mastery");
    else if (m.success <= 0.01) toast(`${name}: that choice did not pan out`, "loss");
    else toast(`${name} Mastery ${m.after >= m.before ? "↑" : "↓"} (calibration ${Math.round(m.success * 100)}%)`, "mastery");
  }
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
