import { clamp, round, type EvidenceTier } from "@ender/shared";

export const EVIDENCE_MULTIPLIER: Record<EvidenceTier, number> = {
  veiled: 0.7,
  attuned: 0.85,
  trialed: 1.0,
  witnessed: 1.1,
};

export const tierRank = (t: EvidenceTier) => ["veiled", "attuned", "trialed", "witnessed"].indexOf(t);

export const artifactPower = (technicalScore: number, tier: EvidenceTier) =>
  round(clamp(technicalScore * EVIDENCE_MULTIPLIER[tier], 0, 110), 1);
