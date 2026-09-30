// Ender — The Bound King: phases, stagger, attack selection.
#pragma once

#include <array>
#include <cstdint>

#include "CombatRules.h"
#include "RunRandom.h"

namespace EnderRules
{
	namespace BoundKing
	{
		constexpr double Phase2At = 0.70;
		constexpr double Phase3At = 0.35;
		constexpr double TransitionDuration = 2.0;
		constexpr double AddsAt = 0.80;
		constexpr double FirstKillTargetMin = 75, FirstKillTargetMax = 110;

		constexpr double StaggerMax = 100;
		constexpr double StaggerDecayDelay = 6.0;
		constexpr double StaggerDecayPerSecond = 7.0;
		constexpr double StaggerDuration = 4.5;
		constexpr double StaggeredDamageBonus = 0.25;

		constexpr double Phase2AttackSpeed = 1.10;
		constexpr double Phase3MoveSpeed = 1.12;
		constexpr double Phase3CooldownMul = 0.85;
	}

	enum class EBossAttack : uint8_t { Sweep, InkLance, BoundCircle, ChainPull, ManuscriptCollapse, Count };
	constexpr int32_t NumBossAttacks = static_cast<int32_t>(EBossAttack::Count);

	struct FBossAttackSpec
	{
		EBossAttack Id;
		int32_t FromPhase;       // 1-based
		ETelegraphClass Class;
		double Telegraph;
		double Damage;
		double BaseCooldown;
		double Duration;         // telegraph + resolve, used to hold the attack slot
	};

	/**
	 * Telegraphs are the spec's own numbers. Three of them sit below a floor the spec
	 * also sets, so each is classed by the floor it does meet and the conflict is listed
	 * in docs/COMBAT_SPEC.md ("Spec conflicts"): Sweep 0.72 s and Ink Lance 0.70 s are
	 * under "boss major" 0.95 s (classed Projectile, 0.60 s); Manuscript Collapse 1.15 s is
	 * under "boss lethal" 1.20 s (classed Boss Major; 30 damage is not lethal from full).
	 */
	inline FBossAttackSpec BossAttack(EBossAttack A)
	{
		switch (A)
		{
		case EBossAttack::Sweep: return {A, 1, ETelegraphClass::Projectile, 0.72, 18, 3.5, 1.3};
		case EBossAttack::InkLance: return {A, 1, ETelegraphClass::Projectile, 0.70, 16, 4.5, 1.2};
		case EBossAttack::BoundCircle: return {A, 2, ETelegraphClass::BossMajor, 1.05, 26, 8.0, 1.6};
		case EBossAttack::ChainPull: return {A, 2, ETelegraphClass::Heavy, 0.80, 8, 10.0, 1.3};
		case EBossAttack::ManuscriptCollapse: return {A, 3, ETelegraphClass::BossMajor, 1.15, 30, 12.0, 2.2};
		default: return {A, 1, ETelegraphClass::BossMajor, 1.0, 0, 5, 1};
		}
	}

	namespace BossGeometry
	{
		constexpr double SweepRange = 400, SweepArc = 180;
		constexpr double LanceWidth = 75, LanceSpeed = 1200;
		constexpr double CircleRadius = 280;
		constexpr double ChainPullDistance = 250;
		constexpr int32_t CollapseLanes = 3;
		constexpr double CollapseLaneWidth = 200, CollapseLaneDelay = 0.25;
	}

	struct FBoundKingState
	{
		double MaxHealth = 6400;
		double Health = 6400;
		int32_t Phase = 1;
		double TransitionLeft = 0;
		bool bTutorial = false; // tutorial fight never enters Phase 3
		bool bAddsSpawned = false;

		double Stagger = 0;
		double SinceStaggerGain = 0;
		double StaggeredLeft = 0;

		std::array<double, NumBossAttacks> CooldownLeft{};
		bool bCollapseActive = false;
		bool bCircleActive = false;

		double HealthFraction() const { return MaxHealth > 0 ? Health / MaxHealth : 0; }
		bool IsTransitioning() const { return TransitionLeft > 0; }
		bool IsStaggered() const { return StaggeredLeft > 0; }
		bool CanAct() const { return !IsTransitioning() && !IsStaggered() && Health > 0; }
		bool IsInvulnerable() const { return IsTransitioning(); }

		double DamageTakenBonus() const { return IsStaggered() ? BoundKing::StaggeredDamageBonus : 0.0; }
		double AttackSpeedMul() const { return Phase >= 2 ? BoundKing::Phase2AttackSpeed : 1.0; }
		double MoveSpeedMul() const { return Phase >= 3 ? BoundKing::Phase3MoveSpeed : 1.0; }
		double CooldownMul() const { return Phase >= 3 ? BoundKing::Phase3CooldownMul : 1.0; }

		/** Outcome of a hit, for the actor to turn into cues. */
		struct FHitOutcome
		{
			double Applied = 0;
			bool bPhaseChanged = false;
			bool bStaggerBroke = false;
			bool bSpawnAdds = false;
			bool bDied = false;
		};

		FHitOutcome ApplyHit(double Damage, double StaggerGain)
		{
			FHitOutcome O;
			if (Health <= 0 || IsInvulnerable()) return O;
			O.Applied = Damage * (1.0 + DamageTakenBonus());
			Health = Health - O.Applied < 0 ? 0 : Health - O.Applied;

			if (!IsStaggered() && StaggerGain > 0)
			{
				Stagger += StaggerGain;
				SinceStaggerGain = 0;
				if (Stagger >= BoundKing::StaggerMax)
				{
					Stagger = 0; // reset to zero afterward (meter restarts once broken)
					StaggeredLeft = BoundKing::StaggerDuration;
					O.bStaggerBroke = true;
				}
			}

			const double F = HealthFraction();
			if (!bAddsSpawned && F <= BoundKing::AddsAt)
			{
				bAddsSpawned = true;
				O.bSpawnAdds = true;
			}
			const int32_t Target = F > BoundKing::Phase2At ? 1 : (F > BoundKing::Phase3At || bTutorial ? 2 : 3);
			if (Target > Phase && Health > 0)
			{
				Phase = Target;
				TransitionLeft = BoundKing::TransitionDuration;
				StaggeredLeft = 0;
				bCollapseActive = bCircleActive = false;
				O.bPhaseChanged = true;
			}
			O.bDied = Health <= 0;
			return O;
		}

		void Tick(double Dt)
		{
			if (TransitionLeft > 0) TransitionLeft = TransitionLeft - Dt < 0 ? 0 : TransitionLeft - Dt;
			if (StaggeredLeft > 0) StaggeredLeft = StaggeredLeft - Dt < 0 ? 0 : StaggeredLeft - Dt;
			SinceStaggerGain += Dt;
			if (!IsStaggered() && SinceStaggerGain > BoundKing::StaggerDecayDelay && Stagger > 0)
			{
				const double DecayTime = SinceStaggerGain - BoundKing::StaggerDecayDelay < Dt ? SinceStaggerGain - BoundKing::StaggerDecayDelay : Dt;
				Stagger = Stagger - BoundKing::StaggerDecayPerSecond * DecayTime < 0 ? 0 : Stagger - BoundKing::StaggerDecayPerSecond * DecayTime;
			}
			for (double& C : CooldownLeft) C = C - Dt < 0 ? 0 : C - Dt;
		}

		bool Allowed(EBossAttack A) const
		{
			const FBossAttackSpec S = BossAttack(A);
			if (S.FromPhase > Phase) return false;
			if (CooldownLeft[static_cast<int32_t>(A)] > 0) return false;
			// Never Manuscript Collapse and Bound Circle at the same time.
			if (A == EBossAttack::ManuscriptCollapse && bCircleActive) return false;
			if (A == EBossAttack::BoundCircle && bCollapseActive) return false;
			return true;
		}

		/** Picks the next attack. Newest-phase attacks weigh more. Returns Count if nothing is ready. */
		EBossAttack ChooseAttack(double DistanceToPlayer, FRunRandom& Rng) const
		{
			if (!CanAct()) return EBossAttack::Count;
			double W[NumBossAttacks] = {};
			double Total = 0;
			for (int32_t I = 0; I < NumBossAttacks; ++I)
			{
				const auto A = static_cast<EBossAttack>(I);
				if (!Allowed(A)) continue;
				double Wt = 1.0 + (BossAttack(A).FromPhase == Phase ? 1.0 : 0.0);
				if (A == EBossAttack::Sweep) Wt *= DistanceToPlayer <= BossGeometry::SweepRange ? 2.0 : 0.1;
				if (A == EBossAttack::ChainPull) Wt *= DistanceToPlayer > 500 ? 2.0 : 0.5;
				W[I] = Wt;
				Total += Wt;
			}
			if (Total <= 0) return EBossAttack::Count;
			double Roll = Rng.NextUnit() * Total;
			for (int32_t I = 0; I < NumBossAttacks; ++I)
			{
				if (W[I] <= 0) continue;
				Roll -= W[I];
				if (Roll <= 0) return static_cast<EBossAttack>(I);
			}
			return EBossAttack::Count;
		}

		void BeginAttack(EBossAttack A)
		{
			const FBossAttackSpec S = BossAttack(A);
			CooldownLeft[static_cast<int32_t>(A)] = S.BaseCooldown * CooldownMul();
			if (A == EBossAttack::ManuscriptCollapse) bCollapseActive = true;
			if (A == EBossAttack::BoundCircle) bCircleActive = true;
		}

		void EndAttack(EBossAttack A)
		{
			if (A == EBossAttack::ManuscriptCollapse) bCollapseActive = false;
			if (A == EBossAttack::BoundCircle) bCircleActive = false;
		}
	};
}
