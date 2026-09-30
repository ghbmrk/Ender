// Ender — enemy AI support rules: telegraph look over time, hazard ticking,
// performance caps and the Bound King's health derivation.
#pragma once

#include <cstdint>

#include "BossRules.h"
#include "CombatRules.h"
#include "EnemyRules.h"

namespace EnderRules
{
	// ------------------------------------------------------------ telegraph look

	namespace TelegraphLook
	{
		/** Danger colour #E16A54. */
		constexpr double DangerR = 0xE1 / 255.0, DangerG = 0x6A / 255.0, DangerB = 0x54 / 255.0;
		constexpr double PerimeterPx = 2.0;
		constexpr double ColourblindPerimeterPx = 4.0;
		constexpr double WindupFill = 0.25;
		constexpr double ActiveFill = 0.55;
		constexpr double CreamFlashSeconds = 0.070;

		struct FState
		{
			double Progress = 0; // 0 → 1 across the windup
			double Fill = WindupFill;
			double Flash = 0;    // 1 while the cream perimeter flash shows
			bool bActivated = false;
		};

		/** Look at Elapsed seconds after the telegraph began. Activation is exactly at Duration. */
		inline FState At(double Elapsed, double Duration)
		{
			FState S;
			S.Progress = Duration > 0 ? Clamp01(Elapsed / Duration) : 1.0;
			S.bActivated = Elapsed >= Duration;
			if (S.bActivated)
			{
				S.Fill = ActiveFill;
				S.Flash = Elapsed - Duration < CreamFlashSeconds ? 1.0 : 0.0;
			}
			return S;
		}

		/** Authored windups never drop under their class floor, whatever a Data Asset says. */
		inline double EffectiveDuration(double Authored, ETelegraphClass Class)
		{
			const double Floor = TelegraphMinimum(Class);
			return Authored < Floor ? Floor : Authored;
		}
	}

	// ------------------------------------------------------------------ hazards

	namespace HazardTicks
	{
		/** Damage is dealt in slices so 7/s does not become sixty damage numbers a second. */
		constexpr double Interval = 0.5;

		inline int32_t Count(double Duration) { return static_cast<int32_t>(Duration / Interval + 1e-9); }
		inline double DamagePerTick(double Dps) { return Dps * Interval; }

		/** Seconds after spawn at which tick I lands (the first lands at activation). */
		inline double TickTime(double ActivationDelay, int32_t I) { return ActivationDelay + Interval * I; }
	}

	// -------------------------------------------------------------- performance

	namespace EnemyLimits
	{
		constexpr int32_t MaxEnemyProjectiles = 24;
		constexpr int32_t MaxActiveNiagara = 60;
		/** Telegraphs each own one Niagara component; hazards one each. Keeps the pair under the Niagara cap. */
		constexpr int32_t MaxTelegraphs = 28;
		constexpr int32_t MaxHazardPools = 10;
		static_assert(MaxTelegraphs + MaxHazardPools < MaxActiveNiagara, "telegraph + hazard VFX must leave Niagara headroom");
	}

	// ------------------------------------------------------- Bound King health

	/**
	 * First-kill target is 75–110 s. The model: the Binder's steady rotation, times gear,
	 * times crit, times an engagement factor for a first attempt (dodging telegraphs,
	 * repositioning, clearing the 80% adds, missed Sever windows), plus the invulnerable
	 * phase transitions.
	 *
	 *   Lash chain 32+32+44 per 1.26 s = 85.7 dps, +46 Thread per chain, +4 Thread/s regen.
	 *   Sever spends 30 Thread for 118 in 0.61 s. Solving time and Thread balance:
	 *   lashing 52.7% of the time, 0.775 Severs/s → 45.2 + 91.5 = 136.7 dps.
	 *   Cooldowns: Bind 22/11 + Unravel 86/7.5 + Grand Fracture 288/38 = 21.1 dps.
	 *   Rotation ≈ 157.7 dps × gear 1.2–1.4 × crit (1 + 0.05·0.5) × engagement 0.35
	 *   = 67.9–79.2 dps. 6400 HP → 80.8–94.2 s, + 2 × 2.0 s transitions = 85–98 s.
	 * The tutorial fight (no gear, one transition) scales health by 0.8: 5120 / 56.6 + 2 ≈ 92 s.
	 */
	namespace BossTuning
	{
		constexpr double MaxHealth = 6400;
		constexpr double TutorialHealthScale = 0.8;
		constexpr double FirstKillEngagement = 0.35;

		inline double RotationDps()
		{
			const double ChainTime = 3 * DefaultTiming(EAbilityId::ThreadLash).Total();
			const double ChainDamage = 2 * ThreadLash::Damage + ThreadLash::ComboDamage;
			const double ChainThread = 2 * ThreadLash::ThreadGain + ThreadLash::ComboThreadGain;
			const double SeverTime = DefaultTiming(EAbilityId::Sever).Total();
			// Lash fraction F and Sever rate R per second: F + R·SeverTime = 1; F·ChainThread/ChainTime + regen = R·cost.
			const double ThreadPerLashSecond = ChainThread / ChainTime;
			const double R = (ThreadPerLashSecond + Thread::RegenPerSecond) / (Sever::ThreadCost + ThreadPerLashSecond * SeverTime);
			const double F = 1.0 - R * SeverTime;
			const double Cooldowns = Bind::Damage / DefaultCooldown(EAbilityId::Bind) +
				Unravel::Damage / DefaultCooldown(EAbilityId::Unravel) +
				3 * GrandFracture::Damage / DefaultCooldown(EAbilityId::GrandFracture);
			return F * ChainDamage / ChainTime + R * Sever::Damage + Cooldowns;
		}

		inline double FirstKillDps(double GearMultiplier)
		{
			const double CritFactor = 1.0 + Damage::BaseCritChance * (Damage::BaseCritMultiplier - 1.0);
			return RotationDps() * GearMultiplier * CritFactor * FirstKillEngagement;
		}

		inline double FirstKillSeconds(double Health, double GearMultiplier, bool bTutorial)
		{
			const int32_t Transitions = bTutorial ? 1 : 2;
			return Health / FirstKillDps(GearMultiplier) + Transitions * BoundKing::TransitionDuration;
		}
	}
}
