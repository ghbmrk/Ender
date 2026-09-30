import { ESSENCES, QUALITY_NAMES } from "@ender/content";

export const fmt = (n: number | null | undefined, dp = 0) => (n === null || n === undefined || Number.isNaN(n) ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp }));
export const crowns = (n: number | null | undefined) => `${fmt(n)} ◈`;
export const qualityName = (q: string) => (QUALITY_NAMES as Record<string, string>)[q] ?? q;
export const essenceName = (e: string) => (ESSENCES as Record<string, { name: string }>)[e]?.name ?? e;
export const essenceColor = (e: string) => (ESSENCES as Record<string, { color: string }>)[e]?.color ?? "#ccc";
export const essenceGlyph = (e: string) => (ESSENCES as Record<string, { glyph: string }>)[e]?.glyph ?? "•";
export const TIER_LABEL: Record<string, string> = { veiled: "Veiled", attuned: "Attuned", trialed: "Trialed", witnessed: "Witnessed" };
export const signed = (n: number) => `${n >= 0 ? "+" : ""}${fmt(n)}`;
