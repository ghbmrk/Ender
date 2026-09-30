/**
 * Ender's painted palette: ink-and-watercolor with rich, saturated jewel tones
 * (sapphire, oxblood, verdigris, violet, gold) on slate and warm stone.
 * Every figure and backdrop draws from these so the cast reads as one set.
 */
export const INK = "#1d1822";
export const INK_SOFT = "#3a3142";
export const PAPER = "#efe3c8";
export const PAPER_DEEP = "#d9c7a2";

export const P = {
  sapphire: ["#16285e", "#23408f", "#3561c4", "#6c93e6", "#b3cbf5"],
  oxblood: ["#3e0d17", "#6b1a28", "#9a2a39", "#c8505a", "#eb9a95"],
  verdigris: ["#0f3a38", "#1c605a", "#2c8f84", "#58bfae", "#a9e6d8"],
  violet: ["#271a45", "#43296f", "#6a44a3", "#9a76d4", "#d2bff2"],
  gold: ["#5a3a0e", "#8f6420", "#c9953a", "#ecc56a", "#fbe8b0"],
  ember: ["#4a1406", "#8c2c0c", "#d4561b", "#f59142", "#ffd3a0"],
  steel: ["#1f2530", "#3a4454", "#5f6c80", "#94a2b6", "#d6dee8"],
  slate: ["#15161d", "#252834", "#393d4d", "#5a5f73", "#8e93a6"],
  stone: ["#3b3128", "#5e4f40", "#8a7862", "#b3a187", "#dccdb2"],
  leather: ["#2a170c", "#4a2a15", "#6f4221", "#9a6535", "#c9965e"],
  bone: ["#4d4538", "#7d725f", "#b2a78f", "#d8cfb8", "#f3ecdb"],
  skin: ["#5a3526", "#8c5a40", "#c08766", "#e2b391", "#f6dcc4"],
  ash: ["#1e1c1f", "#35323a", "#57525c", "#837d86", "#b8b2b8"],
  spirit: ["#10233f", "#1f4a7a", "#3f86c4", "#86c6f2", "#dff3ff"],
} as const;

/** Essence colours, used for loot and effects. */
export const GLOW = { thread: "#9fc3ff", rune: "#ffd98a", hex: "#7dffd6", cold: "#bfe8ff", ember: "#ffb35c", violet: "#c9a8ff" } as const;
