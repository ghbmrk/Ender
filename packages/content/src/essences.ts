import type { EssenceId } from "@ender/shared";

export type EssenceDef = { id: EssenceId; name: string; basePrice: number; color: string; glyph: string; flavor: string };

// Recipe mapping (game abstraction, not chemistry):
// high Burden → Ash, high Knots → Glass, high Veil → Tide,
// high Reach → Root, high Flex → Storm, high Bond → Ember.
export const ESSENCES: Record<EssenceId, EssenceDef> = {
  ember: { id: "ember", name: "Ember", basePrice: 10, color: "#e8743b", glyph: "♨", flavor: "Heat that binds one thing to another." },
  tide: { id: "tide", name: "Tide", basePrice: 8, color: "#3b8fe8", glyph: "≈", flavor: "What hides beneath, and pulls." },
  storm: { id: "storm", name: "Storm", basePrice: 12, color: "#b58cff", glyph: "ϟ", flavor: "Restless motion; it will not keep still." },
  root: { id: "root", name: "Root", basePrice: 9, color: "#5fbf62", glyph: "❦", flavor: "Reaching outward, holding fast." },
  glass: { id: "glass", name: "Glass", basePrice: 11, color: "#7fe3e0", glyph: "◇", flavor: "Intricacy made brittle and bright." },
  ash: { id: "ash", name: "Ash", basePrice: 7, color: "#9a948c", glyph: "▲", flavor: "Weight, residue, what remains." },
};

/** Which quality drives each essence in a recipe. */
export const RECIPE_DRIVERS = {
  burden: "ash",
  knots: "glass",
  veil: "tide",
  reach: "root",
  flex: "storm",
  bond: "ember",
} as const;

/** Hidden mapping from Essence to external market series (developer provenance only). */
export const ESSENCE_MARKET_SERIES: Record<EssenceId, { seriesKey: string; label: string }> = {
  ember: { seriesKey: "USD", label: "ECB reference rate USD per EUR" },
  tide: { seriesKey: "JPY", label: "ECB reference rate JPY per EUR" },
  storm: { seriesKey: "ZAR", label: "ECB reference rate ZAR per EUR" },
  root: { seriesKey: "CHF", label: "ECB reference rate CHF per EUR" },
  glass: { seriesKey: "GBP", label: "ECB reference rate GBP per EUR" },
  ash: { seriesKey: "NOK", label: "ECB reference rate NOK per EUR" },
};
