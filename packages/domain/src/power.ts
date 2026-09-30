import { clamp, round, type CombatStats, type EvidenceTier, type GearSlot } from "@ender/shared";

export const EVIDENCE_MULTIPLIER: Record<EvidenceTier, number> = {
  veiled: 0.7,
  attuned: 0.85,
  trialed: 1.0,
  witnessed: 1.1,
};

export const tierRank = (t: EvidenceTier) => ["veiled", "attuned", "trialed", "witnessed"].indexOf(t);

export const artifactPower = (technicalScore: number, tier: EvidenceTier) =>
  round(clamp(technicalScore * EVIDENCE_MULTIPLIER[tier], 0, 110), 1);

export const BASE_STATS: CombatStats = {
  maxHealth: 120,
  moveSpeed: 230,
  attackDamage: 14,
  attackSpeed: 1,
  critChance: 0.05,
  critMultiplier: 1.75,
  armor: 0,
  cooldownRate: 1,
  projectileSpeed: 640,
  areaMultiplier: 1,
};

export type GearEffect = {
  damageMultiplier: number;
  bonusHealth: number;
  cooldownReduction: number;
  lootPercentileBonus: number;
};

export function gearEffect(slot: GearSlot, power: number): Partial<GearEffect> {
  switch (slot) {
    case "blade":
      return { damageMultiplier: 1 + power / 200 };
    case "ward":
      return { bonusHealth: round(power * 1.5) };
    case "sigil":
      return { cooldownReduction: Math.min(0.25, power * 0.002) };
    case "charm":
      return { lootPercentileBonus: round(power * 0.1, 1) };
  }
}

export type StatInputs = {
  level: number;
  equippedPower: Partial<Record<GearSlot, number>>;
  passive: { damagePct: number; healthFlat: number; critChance: number };
};

export function computeCombatStats(inp: StatInputs): CombatStats & { lootPercentileBonus: number; wardPower: number } {
  const s = { ...BASE_STATS };
  const lvl = Math.max(1, inp.level) - 1;
  // Level scaling is intentionally small.
  let dmgMult = 1 + 0.02 * lvl + inp.passive.damagePct;
  s.maxHealth += 4 * lvl + inp.passive.healthFlat;
  s.critChance += inp.passive.critChance;
  let loot = 0;
  let cdr = 0;
  for (const [slot, p] of Object.entries(inp.equippedPower) as [GearSlot, number][]) {
    const e = gearEffect(slot, p);
    if (e.damageMultiplier) dmgMult *= e.damageMultiplier;
    if (e.bonusHealth) s.maxHealth += e.bonusHealth;
    if (e.cooldownReduction) cdr = e.cooldownReduction;
    if (e.lootPercentileBonus) loot = e.lootPercentileBonus;
  }
  s.attackDamage = round(s.attackDamage * dmgMult, 2);
  s.cooldownRate = round(1 - cdr, 3);
  const powers = Object.values(inp.equippedPower).filter((p): p is number => typeof p === "number");
  const wardPower = powers.length ? Math.max(...powers) : 0;
  return { ...s, lootPercentileBonus: loot, wardPower };
}
