import { QUALITY_KEYS, clamp, noise, round, type FormQualities, type QualityKey } from "@ender/shared";

/** Base half-width of an Attuned reading's uncertainty. */
export const READING_NOISE = 9;

/**
 * What the Binder perceives of a Form's qualities before a Trial.
 * Deterministic per (observer, artifact); passives shrink the noise.
 */
export function readQualities(true_: FormQualities, key: string, noiseMultiplier = 1): FormQualities {
  const out = {} as FormQualities;
  for (const q of QUALITY_KEYS) out[q] = round(clamp(true_[q] + READING_NOISE * noiseMultiplier * noise(`${key}:${q}`), 0, 100), 0);
  return out;
}

/** Choose which qualities a Veiled drop reveals (1–2, plus passive extras). */
export function revealedQualityKeys(key: string, count: number): QualityKey[] {
  const order = [...QUALITY_KEYS].sort((a, b) => noise(`${key}:reveal:${a}`) - noise(`${key}:reveal:${b}`));
  return order.slice(0, Math.max(1, Math.min(QUALITY_KEYS.length, count)));
}
