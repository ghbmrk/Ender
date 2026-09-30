// Ender — the Hushed: archetype defaults, attack tokens, elites.
#pragma once

#include <array>
#include <cstdint>
#include <vector>

#include "CombatRules.h"

namespace EnderRules
{
	enum class EArchetype : uint8_t { Husk, Hound, Wisp, Keeper, Seer, Count };
	constexpr int32_t NumArchetypes = static_cast<int32_t>(EArchetype::Count);

	enum class ETokenPool : uint8_t { Melee, Ranged, Heavy, Count };
	constexpr int32_t NumTokenPools = static_cast<int32_t>(ETokenPool::Count);

	/** Fantasy quality a kill biases Form selection toward. Order matches the service's quality keys. */
	enum class EQuality : uint8_t { Burden, Veil, Reach, Knots, Flex, Bond, Count };
	constexpr int32_t NumQualities = static_cast<int32_t>(EQuality::Count);

	struct FEnemyAttack
	{
		ETokenPool Pool = ETokenPool::Melee;
		ETelegraphClass Class = ETelegraphClass::MinorMelee;
		double Telegraph = 0.4;
		double Recovery = 0.75;
		double Damage = 10;
		double Range = 160;
		double Cooldown = 0;
	};

	struct FArchetypeStats
	{
		const char* Name = "";
		double Health = 0;
		double Armor = 0;
		double MoveSpeed = 0;
		int32_t Cost = 1;
		double PreferredRangeMin = 0;
		double PreferredRangeMax = 0;
		FEnemyAttack Primary;
		bool bHasHeavy = false;
		FEnemyAttack Heavy;
		/** Up to two biased qualities; Count means none. */
		EQuality Bias[2] = {EQuality::Count, EQuality::Count};
		bool bBlocksEnemyProjectiles = false;
	};

	inline FArchetypeStats DefaultStats(EArchetype A)
	{
		FArchetypeStats S;
		switch (A)
		{
		case EArchetype::Husk:
			S.Name = "Husk";
			S.Health = 90; S.MoveSpeed = 420; S.Cost = 1;
			S.Primary = {ETokenPool::Melee, ETelegraphClass::MinorMelee, 0.43, 0.75, 10, 160, 0};
			S.Bias[0] = EQuality::Burden;
			break;
		case EArchetype::Hound:
			S.Name = "Hound";
			S.Health = 60; S.MoveSpeed = 630; S.Cost = 1;
			S.Primary = {ETokenPool::Melee, ETelegraphClass::FastLeap, 0.58, 1.10, 9, 450, 0};
			S.Bias[0] = EQuality::Flex;
			break;
		case EArchetype::Wisp:
			S.Name = "Wisp";
			S.Health = 55; S.MoveSpeed = 340; S.Cost = 2;
			S.PreferredRangeMin = S.PreferredRangeMax = 700;
			S.Primary = {ETokenPool::Ranged, ETelegraphClass::Projectile, 0.62, 0.3, 11, 900, 1.65};
			S.Bias[0] = EQuality::Reach;
			break;
		case EArchetype::Keeper:
			S.Name = "Keeper";
			S.Health = 270; S.Armor = 20; S.MoveSpeed = 300; S.Cost = 4;
			S.Primary = {ETokenPool::Melee, ETelegraphClass::MinorMelee, 0.45, 0.8, 14, 200, 0};
			S.bHasHeavy = true;
			S.Heavy = {ETokenPool::Heavy, ETelegraphClass::Heavy, 0.92, 1.1, 24, 260, 4.0};
			S.Bias[0] = EQuality::Knots;
			S.bBlocksEnemyProjectiles = true;
			break;
		case EArchetype::Seer:
			S.Name = "Seer";
			S.Health = 105; S.MoveSpeed = 320; S.Cost = 3;
			S.PreferredRangeMin = 600; S.PreferredRangeMax = 800;
			S.Primary = {ETokenPool::Ranged, ETelegraphClass::DangerZone, 0.85, 0.6, 7, 800, 4.0};
			S.Bias[0] = EQuality::Veil; S.Bias[1] = EQuality::Bond;
			break;
		default:
			break;
		}
		return S;
	}

	namespace Wisp { constexpr double ProjectileSpeed = 900.0; }
	namespace Hound { constexpr double MinOrbitBeforeFirstLeap = 0.45; }

	namespace Seer
	{
		constexpr double HazardRadius = 220.0;
		constexpr double ActivationDelay = 0.20;
		constexpr double HazardDuration = 3.5;
		constexpr double HazardDps = 7.0;
		constexpr int32_t MaxPoolsPerSeer = 2;
	}

	// ------------------------------------------------------------------ elites

	enum class EEliteModifier : uint8_t { None, Hardened, Volatile };

	namespace Elite
	{
		constexpr double HardenedHealthMul = 2.4;
		constexpr double HardenedArmorAdd = 20.0;
		constexpr double HardenedScale = 1.12;
		constexpr double VolatileTelegraph = 0.85;
		constexpr double VolatileRadius = 300.0;
		constexpr double VolatileDamage = 24.0;

		/** Threat-budget cost of an elite of this archetype. */
		inline int32_t Cost(EArchetype A) { return DefaultStats(A).Cost * 2 + 2; }
	}

	/** One modifier maximum: this signature cannot express two. */
	inline FArchetypeStats ApplyElite(FArchetypeStats S, EEliteModifier M)
	{
		if (M == EEliteModifier::Hardened)
		{
			S.Health *= Elite::HardenedHealthMul;
			S.Armor += Elite::HardenedArmorAdd;
		}
		return S;
	}

	// --------------------------------------------------------- attack tokens

	/**
	 * Attack tokens cap simultaneous attackers. An enemy must hold a token of the
	 * attack's pool before its windup starts; without one it repositions, orbits
	 * or threatens. Tokens return on recovery end, death, stagger or root.
	 */
	struct FAttackTokenPools
	{
		std::array<int32_t, NumTokenPools> Capacity{{4, 2, 1}};
		std::array<std::vector<uint32_t>, NumTokenPools> Holders;

		static ETokenPool PoolFor(EArchetype A, bool bHeavy)
		{
			return bHeavy ? DefaultStats(A).Heavy.Pool : DefaultStats(A).Primary.Pool;
		}

		int32_t InUse(ETokenPool P) const { return static_cast<int32_t>(Holders[static_cast<int32_t>(P)].size()); }

		bool Holds(ETokenPool P, uint32_t Enemy) const
		{
			for (uint32_t H : Holders[static_cast<int32_t>(P)])
				if (H == Enemy) return true;
			return false;
		}

		/** Grants at most one token per enemy per pool. Idempotent for a holder. */
		bool TryAcquire(ETokenPool P, uint32_t Enemy)
		{
			if (Holds(P, Enemy)) return true;
			auto& H = Holders[static_cast<int32_t>(P)];
			if (static_cast<int32_t>(H.size()) >= Capacity[static_cast<int32_t>(P)]) return false;
			H.push_back(Enemy);
			return true;
		}

		void Release(ETokenPool P, uint32_t Enemy)
		{
			auto& H = Holders[static_cast<int32_t>(P)];
			for (size_t I = 0; I < H.size(); ++I)
				if (H[I] == Enemy)
				{
					H[I] = H.back();
					H.pop_back();
					return;
				}
		}

		void ReleaseAll(uint32_t Enemy)
		{
			for (int32_t P = 0; P < NumTokenPools; ++P) Release(static_cast<ETokenPool>(P), Enemy);
		}

		bool WithinCaps() const
		{
			for (int32_t P = 0; P < NumTokenPools; ++P)
				if (static_cast<int32_t>(Holders[P].size()) > Capacity[P]) return false;
			return true;
		}
	};
}
