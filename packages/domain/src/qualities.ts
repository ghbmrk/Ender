import { QUALITY_KEYS, clamp, percentile, round, type FormQualities, type FormRealityData, type QualityKey } from "@ender/shared";

/** Raw source value per fantasy quality (game abstraction, not scientific interpretation). */
export function rawQualityValues(r: FormRealityData): Record<QualityKey, number | undefined> {
  return {
    burden: r.molecularWeight,
    veil: r.xlogp,
    reach: r.tpsa,
    knots: r.complexity,
    flex: r.rotatableBondCount,
    bond:
      r.hBondDonorCount === undefined && r.hBondAcceptorCount === undefined
        ? undefined
        : 2 * (r.hBondDonorCount ?? 0) + (r.hBondAcceptorCount ?? 0),
  };
}

export type NormalizationBands = Record<QualityKey, { p05: number; p95: number }>;

/** p05/p95 bands over the corpus for each quality. */
export function computeBands(corpus: FormRealityData[]): NormalizationBands {
  const out = {} as NormalizationBands;
  for (const q of QUALITY_KEYS) {
    const vals = corpus
      .map((c) => rawQualityValues(c)[q])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => a - b);
    out[q] = { p05: percentile(vals, 0.05), p95: percentile(vals, 0.95) };
  }
  return out;
}

/** p05 → 0, p95 → 100, clamped outside the band. Missing values map to 50. */
export function normalize(value: number | undefined, band: { p05: number; p95: number }): number {
  if (value === undefined || !Number.isFinite(value)) return 50;
  const span = band.p95 - band.p05;
  if (span <= 0) return 50;
  return round(clamp(((value - band.p05) / span) * 100, 0, 100), 1);
}

export function toQualities(r: FormRealityData, bands: NormalizationBands): FormQualities {
  const raw = rawQualityValues(r);
  const q = {} as FormQualities;
  for (const k of QUALITY_KEYS) q[k] = normalize(raw[k], bands[k]);
  return q;
}

export const qualityDistance = (a: FormQualities, b: FormQualities) =>
  Math.sqrt(QUALITY_KEYS.reduce((s, k) => s + (a[k] - b[k]) ** 2, 0));
