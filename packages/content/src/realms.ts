import type { EssenceId, RealmObjective } from "@ender/shared";

export type EnemyKind = "husk" | "wisp" | "hound" | "keeper" | "seer" | "swarm";

export type RealmTemplate = {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3;
  tagline: string;
  palette: { floor: number; wall: number; accent: number; fog: number };
  objective: RealmObjective;
  essenceDrops: Partial<Record<EssenceId, number>>;
  enemyWeights: Partial<Record<EnemyKind, number>>;
  /** Plain-language bias shown to players (fantasy terms only). */
  bias: string[];
};

export const REALMS: RealmTemplate[] = [
  {
    id: "ashen-vault",
    name: "Ashen Vault",
    difficulty: 1,
    tagline: "Cinders drift through collapsed reliquaries.",
    palette: { floor: 0x1d1714, wall: 0x3b2a22, accent: 0xe8743b, fog: 0x2a1a12 },
    objective: {
      id: "ashen-vault",
      constraints: [
        { quality: "burden", mode: "minimize", weight: 0.35 },
        { quality: "knots", mode: "maximize", weight: 0.4 },
        { quality: "veil", mode: "target", target: 45, tolerance: 20, weight: 0.25 },
      ],
    },
    essenceDrops: { ash: 3, glass: 3, ember: 1.5, storm: 1 },
    enemyWeights: { husk: 3, hound: 2, wisp: 1.5, swarm: 1.5, keeper: 0.5, seer: 0.5 },
    bias: ["Light Forms", "Many Knots", "Balanced Veil"],
  },
  {
    id: "glass-fen",
    name: "Glass Fen",
    difficulty: 2,
    tagline: "A drowned marsh where the reeds ring like bells.",
    palette: { floor: 0x0f1a1c, wall: 0x1e3a3c, accent: 0x7fe3e0, fog: 0x0c2224 },
    objective: {
      id: "glass-fen",
      constraints: [
        { quality: "reach", mode: "maximize", weight: 0.3 },
        { quality: "veil", mode: "target", target: 40, tolerance: 25, weight: 0.35 },
        { quality: "flex", mode: "maximize", weight: 0.35 },
      ],
    },
    essenceDrops: { tide: 3, root: 3, storm: 2, glass: 1 },
    enemyWeights: { wisp: 3, seer: 2, swarm: 2, hound: 1.5, husk: 1, keeper: 0.8 },
    bias: ["Far Reach", "Deep Veil", "Supple Flex"],
  },
  {
    id: "hollow-keep",
    name: "Hollow Keep",
    difficulty: 3,
    tagline: "A fortress built around something that is no longer there.",
    palette: { floor: 0x16141c, wall: 0x2c2838, accent: 0xb58cff, fog: 0x1a1426 },
    objective: {
      id: "hollow-keep",
      constraints: [
        { quality: "burden", mode: "minimize", weight: 0.3 },
        { quality: "knots", mode: "maximize", weight: 0.3 },
        { quality: "bond", mode: "target", target: 55, tolerance: 15, weight: 0.2 },
        { quality: "flex", mode: "minimize", weight: 0.2 },
      ],
    },
    essenceDrops: { ember: 3, glass: 2, ash: 2, root: 1.5, storm: 1 },
    enemyWeights: { keeper: 2.5, seer: 2, husk: 2, hound: 2, wisp: 1.5, swarm: 1 },
    bias: ["Light Forms", "Intricate", "Tight Bonds", "Rigid"],
  },
];

export const realmById = (id: string) => {
  const r = REALMS.find((x) => x.id === id);
  if (!r) throw new Error(`unknown realm ${id}`);
  return r;
};

export const ENEMIES: Record<EnemyKind, { name: string; hp: number; speed: number; damage: number; radius: number; color: number; xpCrowns: number }> = {
  husk: { name: "Husk", hp: 42, speed: 70, damage: 12, radius: 16, color: 0x8a7a66, xpCrowns: 3 },
  wisp: { name: "Wisp", hp: 24, speed: 95, damage: 8, radius: 11, color: 0x9fd7ff, xpCrowns: 3 },
  hound: { name: "Hound", hp: 30, speed: 185, damage: 9, radius: 13, color: 0xc2573a, xpCrowns: 3 },
  keeper: { name: "Keeper", hp: 140, speed: 50, damage: 18, radius: 24, color: 0x6b6f86, xpCrowns: 6 },
  seer: { name: "Seer", hp: 36, speed: 60, damage: 20, radius: 14, color: 0xc58cff, xpCrowns: 5 },
  swarm: { name: "Swarm", hp: 8, speed: 150, damage: 4, radius: 7, color: 0xd6c25b, xpCrowns: 1 },
};

export type EliteModifier = "hardened" | "volatile";

export const BOSS = {
  name: "The Bound King",
  hp: 1400,
  wardTargets: [25, 45, 65] as const,
};
