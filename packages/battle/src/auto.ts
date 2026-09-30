import { skillById, type Grade } from "./defs";
import type { Battle } from "./battle";

/**
 * A simple party brain for auto-battle and tests: heal when someone is low, otherwise spend AP on the strongest
 * affordable skill, focusing broken or wounded foes.
 */
export function autoHeroAction(b: Battle, actorId: string): { skillId: string; targetId: string } {
  const me = b.unit(actorId);
  const foes = b.living("foe");
  const party = b.living("party");
  const usable = b.skillsFor(actorId).filter((s) => s.usable).map((s) => s.skill);
  const has = (id: string) => usable.some((s) => s.id === id);
  const focus = [...foes].sort((a, c) => Number(c.broken) - Number(a.broken) || a.hp - c.hp)[0]!;
  const low = [...party].sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0]!;
  if (has("mend") && low.hp < low.maxHp * 0.45) return { skillId: "mend", targetId: low.id };
  if (me.kind === "warden" && has("bulwark") && me.taunt === 0 && party.some((p) => p.id !== me.id && p.hp < p.maxHp * 0.5)) return { skillId: "bulwark", targetId: me.id };
  const area = usable.filter((s) => s.target === "all-foes");
  if (foes.length >= 2 && area.length) return { skillId: area.sort((a, c) => c.ap - a.ap)[0]!.id, targetId: focus.id };
  if (has("sever") && focus.hp > me.atk * 2) return { skillId: "sever", targetId: focus.id };
  if (has("bash") && !focus.broken && !focus.ward && focus.breakMax - focus.breakVal <= 45) return { skillId: "bash", targetId: focus.id };
  if (has("mark") && focus.mark === 0 && focus.hp > me.atk * 3) return { skillId: "mark", targetId: focus.id };
  if (has("twin") && me.ap >= 4) return { skillId: "twin", targetId: focus.id };
  if (has("lash") && me.ap >= 5) return { skillId: "lash", targetId: focus.id };
  const basic = b.skillsFor(actorId).find((s) => s.skill.apGain)!.skill;
  return { skillId: basic.id, targetId: focus.id };
}

/** Grades for an auto-played skill: all good, or all perfect for a skilled autopilot. */
export const autoGrades = (skillId: string, grade: Grade = "good"): Grade[] => skillById(skillId).beats.map(() => grade);
