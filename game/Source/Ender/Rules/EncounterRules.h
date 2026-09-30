// Ender — encounter planning: threat budgets, composition, waves, spawn placement.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

#include "EnemyRules.h"
#include "RunRandom.h"

namespace EnderRules
{
	enum class ERoomKind : uint8_t { Room1, Room2, Room3, Room4, Elite };

	struct FRoomRules
	{
		int32_t Budget = 8;
		int32_t MinRoles = 1;
		bool Allowed[NumArchetypes] = {true, true, true, true, true};
		bool bElite = false;
	};

	namespace Caps
	{
		constexpr int32_t MaxWisps = 2;
		constexpr int32_t MaxSeers = 1;
		constexpr int32_t MaxKeepers = 2;
		constexpr int32_t MaxNormal = 14;
		constexpr int32_t MaxElites = 2;

		inline int32_t PerArchetype(EArchetype A)
		{
			switch (A)
			{
			case EArchetype::Wisp: return MaxWisps;
			case EArchetype::Seer: return MaxSeers;
			case EArchetype::Keeper: return MaxKeepers;
			default: return MaxNormal;
			}
		}
	}

	/**
	 * Budgets 8/11/13/15/17; minimum distinct roles 1, 2, 2, 3, 3.
	 * First-Realm roster (the first 20 minutes): rooms 1–2 use Husk, Hound, Wisp;
	 * Keeper and Seer join from room 3.
	 */
	inline FRoomRules RulesFor(ERoomKind Kind, bool bFirstRealmRoster = true)
	{
		FRoomRules R;
		switch (Kind)
		{
		case ERoomKind::Room1: R.Budget = 8; R.MinRoles = 1; break;
		case ERoomKind::Room2: R.Budget = 11; R.MinRoles = 2; break;
		case ERoomKind::Room3: R.Budget = 13; R.MinRoles = 2; break;
		case ERoomKind::Room4: R.Budget = 15; R.MinRoles = 3; break;
		case ERoomKind::Elite: R.Budget = 17; R.MinRoles = 3; R.bElite = true; break;
		}
		if (bFirstRealmRoster && (Kind == ERoomKind::Room1 || Kind == ERoomKind::Room2))
		{
			R.Allowed[static_cast<int32_t>(EArchetype::Keeper)] = false;
			R.Allowed[static_cast<int32_t>(EArchetype::Seer)] = false;
		}
		return R;
	}

	struct FPlannedEnemy
	{
		EArchetype Archetype = EArchetype::Husk;
		EEliteModifier Elite = EEliteModifier::None;
		int32_t Wave = 0; // 0 = opening wave, 1 = reinforcement
	};

	struct FEncounterPlan
	{
		std::vector<FPlannedEnemy> Enemies;
		int32_t Spent = 0;
		int32_t WaveCost[2] = {0, 0};

		int32_t CountOf(EArchetype A) const
		{
			int32_t N = 0;
			for (const auto& E : Enemies) N += E.Archetype == A ? 1 : 0;
			return N;
		}
		int32_t NormalCount() const
		{
			int32_t N = 0;
			for (const auto& E : Enemies) N += E.Elite == EEliteModifier::None ? 1 : 0;
			return N;
		}
		int32_t Roles() const
		{
			int32_t N = 0;
			for (int32_t A = 0; A < NumArchetypes; ++A) N += CountOf(static_cast<EArchetype>(A)) > 0 ? 1 : 0;
			return N;
		}
	};

	inline int32_t CostOf(const FPlannedEnemy& E)
	{
		return E.Elite == EEliteModifier::None ? DefaultStats(E.Archetype).Cost : Elite::Cost(E.Archetype);
	}

	/** Every constraint the plan must satisfy. Used by the planner's own assert and by the 100-seed test. */
	inline bool PlanIsValid(const FEncounterPlan& P, const FRoomRules& R)
	{
		if (P.Spent > R.Budget) return false;
		if (P.NormalCount() > Caps::MaxNormal) return false;
		if (P.CountOf(EArchetype::Wisp) > Caps::MaxWisps) return false;
		if (P.CountOf(EArchetype::Seer) > Caps::MaxSeers) return false;
		if (P.CountOf(EArchetype::Keeper) > Caps::MaxKeepers) return false;
		if (P.Roles() < R.MinRoles) return false;
		int32_t Elites = 0;
		for (const auto& E : P.Enemies)
		{
			if (!R.Allowed[static_cast<int32_t>(E.Archetype)]) return false;
			Elites += E.Elite != EEliteModifier::None ? 1 : 0;
		}
		if (Elites > (R.bElite ? 1 : 0)) return false;
		return true;
	}

	namespace Waves
	{
		constexpr double OpeningShare = 0.65;
		constexpr double ReinforceAtPopulation = 0.40;
		constexpr double ReinforceAfter = 14.0;
		constexpr double SpawnDelay = 1.5;
		constexpr double MinSpawnDistance = 400.0;
		constexpr double NoSpawnBehindWithin = 300.0;
	}

	/**
	 * Deterministic composition for one room. Required roles first, then weighted fill
	 * until the budget is spent or no archetype fits. Waves: opening wave takes enemies
	 * until it reaches 65% of the spend; the rest reinforce. The elite always opens.
	 */
	inline FEncounterPlan PlanEncounter(const FRoomRules& R, FRunRandom& Rng)
	{
		FEncounterPlan P;
		int32_t Remaining = R.Budget;

		auto Fits = [&](EArchetype A) {
			const int32_t I = static_cast<int32_t>(A);
			return R.Allowed[I] && DefaultStats(A).Cost <= Remaining && P.CountOf(A) < Caps::PerArchetype(A) &&
				P.NormalCount() < Caps::MaxNormal;
		};
		auto Add = [&](EArchetype A, EEliteModifier M) {
			FPlannedEnemy E{A, M, 0};
			Remaining -= CostOf(E);
			P.Spent += CostOf(E);
			P.Enemies.push_back(E);
		};

		if (R.bElite)
		{
			// Elite archetypes whose elite cost leaves room for the remaining required roles.
			std::vector<EArchetype> Options;
			for (int32_t I = 0; I < NumArchetypes; ++I)
			{
				const auto A = static_cast<EArchetype>(I);
				if (R.Allowed[I] && Elite::Cost(A) <= R.Budget - (R.MinRoles - 1) * 2) Options.push_back(A);
			}
			if (!Options.empty())
			{
				const EArchetype A = Options[Rng.RangeInt(0, static_cast<int32_t>(Options.size()) - 1)];
				Add(A, Rng.Chance(0.5) ? EEliteModifier::Hardened : EEliteModifier::Volatile);
			}
		}

		// Required distinct roles, cheapest-first candidates shuffled deterministically.
		std::vector<EArchetype> Pool;
		for (int32_t I = 0; I < NumArchetypes; ++I)
			if (R.Allowed[I]) Pool.push_back(static_cast<EArchetype>(I));
		for (int32_t I = static_cast<int32_t>(Pool.size()) - 1; I > 0; --I)
			std::swap(Pool[I], Pool[Rng.RangeInt(0, I)]);
		for (EArchetype A : Pool)
		{
			if (P.Roles() >= R.MinRoles) break;
			if (P.CountOf(A) == 0 && Fits(A)) Add(A, EEliteModifier::None);
		}

		// Weighted fill. Cheap roles are commoner, ranged and control are rarer.
		const double Weight[NumArchetypes] = {4.0, 3.0, 1.6, 0.9, 0.8};
		for (int32_t Guard = 0; Guard < 64 && Remaining > 0; ++Guard)
		{
			double Total = 0;
			for (int32_t I = 0; I < NumArchetypes; ++I)
				if (Fits(static_cast<EArchetype>(I))) Total += Weight[I];
			if (Total <= 0) break;
			double Roll = Rng.NextUnit() * Total;
			for (int32_t I = 0; I < NumArchetypes; ++I)
			{
				if (!Fits(static_cast<EArchetype>(I))) continue;
				Roll -= Weight[I];
				if (Roll <= 0)
				{
					Add(static_cast<EArchetype>(I), EEliteModifier::None);
					break;
				}
			}
		}

		// Waves.
		std::vector<int32_t> Order(P.Enemies.size());
		for (size_t I = 0; I < Order.size(); ++I) Order[I] = static_cast<int32_t>(I);
		for (int32_t I = static_cast<int32_t>(Order.size()) - 1; I > 0; --I)
			std::swap(Order[I], Order[Rng.RangeInt(0, I)]);
		std::stable_partition(Order.begin(), Order.end(),
			[&](int32_t I) { return P.Enemies[I].Elite != EEliteModifier::None; });
		const double OpeningTarget = Waves::OpeningShare * P.Spent;
		for (int32_t I : Order)
		{
			FPlannedEnemy& E = P.Enemies[I];
			E.Wave = (P.WaveCost[0] < OpeningTarget || E.Elite != EEliteModifier::None) ? 0 : 1;
			P.WaveCost[E.Wave] += CostOf(E);
		}
		return P;
	}

	/** Reinforcements come when the opening wave is down to ≤40% of its population, or after 14 s. */
	inline bool ShouldReinforce(int32_t OpeningPopulation, int32_t Alive, double Elapsed)
	{
		if (OpeningPopulation <= 0) return true;
		return Alive <= static_cast<int32_t>(std::floor(Waves::ReinforceAtPopulation * OpeningPopulation)) ||
			Elapsed >= Waves::ReinforceAfter;
	}

	/**
	 * Spawn point legality, 2D. At least 400 cm from the player, and never within
	 * 300 cm in the player's rear half-plane.
	 */
	inline bool SpawnPointAllowed(double PX, double PY, double FaceX, double FaceY, double SX, double SY)
	{
		const double DX = SX - PX, DY = SY - PY;
		const double Dist = std::sqrt(DX * DX + DY * DY);
		if (Dist < Waves::MinSpawnDistance) return false;
		const bool bBehind = DX * FaceX + DY * FaceY < 0;
		if (bBehind && Dist < Waves::NoSpawnBehindWithin) return false;
		return true;
	}

	// ---------------------------------------------------------- room geometry

	namespace RoomGeometry
	{
		constexpr double MinWidth = 1800, MinDepth = 1600;
		constexpr double TypicalWidth = 2400, TypicalDepth = 2000;
		constexpr double MinCorridor = 450;
		constexpr double MinObstacleCoverage = 0.10, MaxObstacleCoverage = 0.22;

		inline bool AreaValid(double W, double D) { return std::max(W, D) >= MinWidth && std::min(W, D) >= MinDepth; }
		inline bool CoverageValid(double C) { return C >= MinObstacleCoverage && C <= MaxObstacleCoverage; }
	}

	// ---------------------------------------------------------------- pacing

	namespace Pacing
	{
		constexpr double NormalRoomMin = 25, NormalRoomMax = 40;
		constexpr double EliteRoomMin = 45, EliteRoomMax = 65;
		constexpr double TravelMin = 4, TravelMax = 10;
		constexpr double CombatShareTarget = 0.70;
	}
}
