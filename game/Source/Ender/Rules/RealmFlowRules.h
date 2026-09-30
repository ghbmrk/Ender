// Ender — Realm flow: the fixed segment sequence, Focus, pacing targets, the
// Realm's Form pool and the offline "ordinary loot" fallback.
#pragma once

#include <algorithm>
#include <cstdint>
#include <vector>

#include "EncounterRules.h"
#include "LootRules.h"
#include "RunRandom.h"

namespace EnderRules
{
	/** Mirrors EEnderRealmSegment one-to-one. */
	enum class ERealmSegment : uint8_t
	{
		Entry, Room1, Connector, Room2, AttunementShrine, Room3, Room4, Elite, RecoverySpace, Boss, RewardAltar, ReturnPortal, Count
	};
	constexpr int32_t NumRealmSegments = static_cast<int32_t>(ERealmSegment::Count);

	namespace RealmFlow
	{
		/** Entry → Room 1 → Connector → Room 2 → Shrine → Room 3 → Room 4 → Elite → Recovery → Boss → Altar → Portal. */
		inline ERealmSegment Next(ERealmSegment S)
		{
			const int32_t I = static_cast<int32_t>(S);
			return I + 1 >= NumRealmSegments ? ERealmSegment::ReturnPortal : static_cast<ERealmSegment>(I + 1);
		}

		inline bool IsCombat(ERealmSegment S)
		{
			switch (S)
			{
			case ERealmSegment::Room1: case ERealmSegment::Room2: case ERealmSegment::Room3:
			case ERealmSegment::Room4: case ERealmSegment::Elite: case ERealmSegment::Boss:
				return true;
			default:
				return false;
			}
		}

		/** Room kind for an encounter segment; false for non-encounter segments (the Boss has its own arena). */
		inline bool RoomKindFor(ERealmSegment S, ERoomKind& Out)
		{
			switch (S)
			{
			case ERealmSegment::Room1: Out = ERoomKind::Room1; return true;
			case ERealmSegment::Room2: Out = ERoomKind::Room2; return true;
			case ERealmSegment::Room3: Out = ERoomKind::Room3; return true;
			case ERealmSegment::Room4: Out = ERoomKind::Room4; return true;
			case ERealmSegment::Elite: Out = ERoomKind::Elite; return true;
			default: return false;
			}
		}

		inline EDropSource DropSourceFor(ERoomKind K)
		{
			switch (K)
			{
			case ERoomKind::Room1: return EDropSource::Room1;
			case ERoomKind::Room2: return EDropSource::Room2;
			case ERoomKind::Room3: return EDropSource::Room3;
			case ERoomKind::Room4: return EDropSource::Room4;
			case ERoomKind::Elite: return EDropSource::Elite;
			}
			return EDropSource::Room1;
		}

		/** Service room index (apps/server RunPlan: 0–4 combat, 5 shrine, 6 elite, 7 boss) for checkpoints. */
		inline int32_t ServiceRoomIndex(ERealmSegment S)
		{
			switch (S)
			{
			case ERealmSegment::Room1: return 0;
			case ERealmSegment::Room2: return 1;
			case ERealmSegment::Room3: return 2;
			case ERealmSegment::Room4: return 3;
			case ERealmSegment::AttunementShrine: return 5;
			case ERealmSegment::Elite: return 6;
			case ERealmSegment::Boss: return 7;
			default: return -1;
			}
		}

		constexpr double FirstCompletionMin = 7 * 60.0;
		constexpr double FirstCompletionMax = 10 * 60.0;
	}

	/** Focus: 12 per Realm, refreshed at Realm entry, spent by Familiar actions. */
	struct FFocusWallet
	{
		int32_t Current = Focus::PerRealm;
		int32_t Max = Focus::PerRealm;

		void Refresh(int32_t Bonus = 0) { Max = Focus::PerRealm + std::max(0, Bonus); Current = Max; }
		bool CanAfford(EFamiliarAction A) const { return Current >= Focus::Cost(A); }
		bool TrySpend(EFamiliarAction A)
		{
			if (!CanAfford(A)) return false;
			Current -= Focus::Cost(A);
			return true;
		}
	};

	/** Recorded (not enforced) pacing: combat share of active time and per-segment durations. */
	struct FPacingLog
	{
		double SegmentSeconds[NumRealmSegments] = {};
		double CombatSeconds = 0;
		double ActiveSeconds = 0;

		void Add(ERealmSegment S, double Seconds)
		{
			SegmentSeconds[static_cast<int32_t>(S)] += Seconds;
			ActiveSeconds += Seconds;
			if (RealmFlow::IsCombat(S)) CombatSeconds += Seconds;
		}
		double CombatShare() const { return ActiveSeconds > 0 ? CombatSeconds / ActiveSeconds : 0; }
		bool WithinFirstCompletionTarget() const
		{
			return ActiveSeconds >= RealmFlow::FirstCompletionMin && ActiveSeconds <= RealmFlow::FirstCompletionMax;
		}
	};

	namespace FormPool
	{
		/** Percentile rank (0–100) of each value within the set; ties share the mean rank. */
		inline std::vector<double> PercentileRanks(const std::vector<double>& V)
		{
			const size_t N = V.size();
			std::vector<double> Out(N, 50.0);
			if (N < 2) return Out;
			std::vector<size_t> Order(N);
			for (size_t I = 0; I < N; ++I) Order[I] = I;
			std::stable_sort(Order.begin(), Order.end(), [&](size_t A, size_t B) { return V[A] < V[B]; });
			size_t I = 0;
			while (I < N)
			{
				size_t J = I;
				while (J + 1 < N && V[Order[J + 1]] == V[Order[I]]) ++J;
				const double Rank = 0.5 * (static_cast<double>(I) + static_cast<double>(J));
				for (size_t K = I; K <= J; ++K) Out[Order[K]] = 100.0 * Rank / static_cast<double>(N - 1);
				I = J + 1;
			}
			return Out;
		}

		/** FNV-1a 64: the service's run seed is a string; the run RNG wants a number. */
		inline uint64_t SeedFromString(const char* S)
		{
			uint64_t H = 0xcbf29ce484222325ull;
			for (; S && *S; ++S)
			{
				H ^= static_cast<uint8_t>(*S);
				H *= 0x100000001b3ull;
			}
			return H;
		}
	}

	/**
	 * Offline fallback: when the reality layer is unavailable a Veiled Form drop
	 * becomes an ordinary item with a rolled power. Deeper sources roll higher;
	 * the band stays below well-evidenced Forms so the reality layer still matters.
	 */
	namespace OrdinaryLoot
	{
		inline void PowerBand(EDropSource S, double& Lo, double& Hi)
		{
			switch (S)
			{
			case EDropSource::Room1: Lo = 15; Hi = 35; break;
			case EDropSource::Room2: Lo = 20; Hi = 40; break;
			case EDropSource::Room3: Lo = 25; Hi = 45; break;
			case EDropSource::Room4: Lo = 30; Hi = 50; break;
			case EDropSource::Elite: Lo = 40; Hi = 60; break;
			case EDropSource::Boss: Lo = 50; Hi = 70; break;
			}
		}

		inline double RollPower(EDropSource S, FRunRandom& Rng)
		{
			double Lo = 15, Hi = 35;
			PowerBand(S, Lo, Hi);
			return Rng.Range(Lo, Hi);
		}

		inline EGearSlot RollSlot(FRunRandom& Rng) { return static_cast<EGearSlot>(Rng.RangeInt(0, 3)); }
	}
}
