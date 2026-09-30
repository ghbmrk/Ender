// Ender — loot drops, Form selection bias, gear and evidence.
#pragma once

#include <cmath>
#include <cstdint>
#include <vector>

#include "EnemyRules.h"
#include "EncounterRules.h"
#include "RunRandom.h"

namespace EnderRules
{
	enum class EDropSource : uint8_t { Room1, Room2, Room3, Room4, Elite, Boss };

	namespace Loot
	{
		/** Chance that a room (not an enemy) yields one Veiled Form on clear. */
		inline double VeiledFormChance(EDropSource S)
		{
			switch (S)
			{
			case EDropSource::Room2: return 0.35;
			case EDropSource::Room3: return 0.50;
			case EDropSource::Room4: return 0.65;
			case EDropSource::Elite: return 1.00;
			default: return 0.0;
			}
		}

		constexpr int32_t BossForms = 2;
		constexpr int32_t EssenceEveryMin = 5, EssenceEveryMax = 8;

		/** Number of Veiled Forms a source yields. Tutorial guarantees the Room 2 Form. */
		inline int32_t VeiledFormsFor(EDropSource S, bool bTutorial, FRunRandom& Rng)
		{
			if (S == EDropSource::Boss) return BossForms;
			if (S == EDropSource::Room2 && bTutorial) return 1;
			return Rng.Chance(VeiledFormChance(S)) ? 1 : 0;
		}
	}

	/** About one Essence bundle per 5–8 normal kills: a countdown re-rolled after each drop. */
	struct FEssenceDropCounter
	{
		int32_t KillsUntilDrop = -1;

		bool OnNormalKill(FRunRandom& Rng)
		{
			if (KillsUntilDrop < 0) KillsUntilDrop = Rng.RangeInt(Loot::EssenceEveryMin, Loot::EssenceEveryMax);
			if (--KillsUntilDrop > 0) return false;
			KillsUntilDrop = Rng.RangeInt(Loot::EssenceEveryMin, Loot::EssenceEveryMax);
			return true;
		}
	};

	/** A candidate the client prefetched for this Realm: its id and fantasy qualities (0–100). */
	struct FCandidateView
	{
		int32_t Index = 0;
		double Qualities[NumQualities] = {};
		double TechnicalPercentile = 50; // 0–100 within the Realm pool
	};

	/**
	 * Tally of which qualities the kills that produced this drop were biased to.
	 * Farming Hounds pushes the Form roll toward high-Flex candidates, etc.
	 */
	struct FFormBias
	{
		double Weight[NumQualities] = {};

		void AddKill(EArchetype A, double Amount = 1.0)
		{
			const FArchetypeStats S = DefaultStats(A);
			const int32_t N = (S.Bias[1] == EQuality::Count) ? 1 : 2;
			for (int32_t I = 0; I < N; ++I) Weight[static_cast<int32_t>(S.Bias[I])] += Amount / N;
		}

		double Total() const
		{
			double T = 0;
			for (double W : Weight) T += W;
			return T;
		}
	};

	/**
	 * Picks a candidate for a Veiled Form. Score = bias-weighted quality affinity
	 * + quality-percentile push from Charm and Discovery Mastery (the latter elite-only,
	 * ≤ +15 points) + deterministic jitter; sampled from the top few so it stays a drop,
	 * not a lookup.
	 */
	inline int32_t ChooseCandidate(const std::vector<FCandidateView>& Pool, const FFormBias& Bias,
		double LootPercentileBonus, double DiscoveryPercentileBonus, bool bElite, FRunRandom& Rng)
	{
		if (Pool.empty()) return -1;
		const double BiasTotal = Bias.Total();
		const double Push = LootPercentileBonus + (bElite ? (DiscoveryPercentileBonus > 15 ? 15 : DiscoveryPercentileBonus) : 0);
		const double TargetPct = 50 + Push;

		struct FScored { int32_t Index; double Score; };
		std::vector<FScored> Scored;
		Scored.reserve(Pool.size());
		for (const FCandidateView& C : Pool)
		{
			double Affinity = 0;
			if (BiasTotal > 0)
				for (int32_t Q = 0; Q < NumQualities; ++Q) Affinity += (Bias.Weight[Q] / BiasTotal) * C.Qualities[Q];
			else
				Affinity = 50;
			const double PctFit = -std::fabs(C.TechnicalPercentile - TargetPct) * 0.4 + (Push > 0 ? C.TechnicalPercentile * Push / 100.0 : 0);
			Scored.push_back({C.Index, Affinity + PctFit + Rng.Range(0, 18)});
		}
		// Partial selection of the top 5.
		const int32_t K = Scored.size() < 5 ? static_cast<int32_t>(Scored.size()) : 5;
		for (int32_t I = 0; I < K; ++I)
			for (size_t J = I + 1; J < Scored.size(); ++J)
				if (Scored[J].Score > Scored[I].Score) std::swap(Scored[I], Scored[J]);
		return Scored[Rng.RangeInt(0, K - 1)].Index;
	}

	// -------------------------------------------------------------- evidence

	enum class EEvidenceTier : uint8_t { Veiled, Attuned, Trialed, Witnessed };

	inline double EvidenceMultiplier(EEvidenceTier T)
	{
		switch (T)
		{
		case EEvidenceTier::Veiled: return 0.70;
		case EEvidenceTier::Attuned: return 0.85;
		case EEvidenceTier::Trialed: return 1.00;
		case EEvidenceTier::Witnessed: return 1.10;
		}
		return 0.70;
	}

	inline double ArtifactPower(double TechnicalScore, EEvidenceTier T)
	{
		return Clamp(TechnicalScore * EvidenceMultiplier(T), 0.0, 110.0);
	}

	// ------------------------------------------------------------------ gear

	enum class EGearSlot : uint8_t { Blade, Ward, Sigil, Charm, Count };

	namespace Gear
	{
		inline double BladeDamageMultiplier(double Power) { return 1.0 + Power / 200.0; }
		inline double WardBonusHealth(double Power) { return Power * 1.5; }
		inline double SigilCooldownReduction(double Power) { return Power * 0.002 < 0.25 ? Power * 0.002 : 0.25; }
		inline double CharmLootPercentileBonus(double Power) { return Power * 0.10; }
	}

	// ----------------------------------------------------------------- Focus

	enum class EFamiliarAction : uint8_t { Attune, Fracture, Temper, Mirror, DeepTrial, Trial };

	namespace Focus
	{
		constexpr int32_t PerRealm = 12;
		inline int32_t Cost(EFamiliarAction A)
		{
			switch (A)
			{
			case EFamiliarAction::Attune: return 1;
			case EFamiliarAction::Fracture: return 1;
			case EFamiliarAction::Temper: return 2;
			case EFamiliarAction::Mirror: return 2;
			case EFamiliarAction::DeepTrial: return 3;
			case EFamiliarAction::Trial: return 0; // deterministic evaluation, no Familiar attention
			}
			return 0;
		}
	}
}
