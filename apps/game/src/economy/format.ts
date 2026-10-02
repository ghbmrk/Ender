import { ESSENCES, QUALITY_NAMES } from "@ender/content";

// One formatter per precision: toLocaleString with options builds a new one on every call, which cost the Realm
// choice ~25 ms of a phone's first frame.
const FMT = new Map<number, Intl.NumberFormat>();
const formatter = (dp: number) => FMT.get(dp) ?? (FMT.set(dp, new Intl.NumberFormat(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp })), FMT.get(dp)!);
// The first number format loads the locale's data (~25 ms on a phone): do it in an idle moment, not in a screen's
// first frame.
try {
  const warm = () => [0, 1, 2].forEach((dp) => formatter(dp).format(1));
  if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 2000 });
  else setTimeout(warm, 300);
} catch {
  /* formats on first use */
}
export const fmt = (n: number | null | undefined, dp = 0) => (n === null || n === undefined || Number.isNaN(n) ? "—" : formatter(dp).format(n));
export const crowns = (n: number | null | undefined) => `${fmt(n)} ◈`;
export const qualityName = (q: string) => (QUALITY_NAMES as Record<string, string>)[q] ?? q;
export const essenceName = (e: string) => (ESSENCES as Record<string, { name: string }>)[e]?.name ?? e;
export const essenceColor = (e: string) => (ESSENCES as Record<string, { color: string }>)[e]?.color ?? "#ccc";
export const essenceGlyph = (e: string) => (ESSENCES as Record<string, { glyph: string }>)[e]?.glyph ?? "•";
export const TIER_LABEL: Record<string, string> = { veiled: "Veiled", attuned: "Attuned", trialed: "Trialed", witnessed: "Witnessed" };
export const signed = (n: number) => `${n >= 0 ? "+" : ""}${fmt(n)}`;
