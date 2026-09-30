// Ender — combat numbers and pure combat math.
//
// Engine-free. The values here are the spec defaults (docs/COMBAT_SPEC.md);
// Data Assets override tuning in the editor, and these constants seed them
// (Tools/Python/create_ender_assets.py) and back the standalone rule tests.
// Units: centimetres, seconds, degrees.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

#include "RunRandom.h"

namespace EnderRules
{
	inline double Clamp(double V, double Lo, double Hi) { return V < Lo ? Lo : (V > Hi ? Hi : V); }
	inline double Clamp01(double V) { return Clamp(V, 0.0, 1.0); }

	// ------------------------------------------------------------------ Binder

	namespace Binder
	{
		constexpr double CapsuleRadius = 40.0;
		constexpr double CapsuleHeight = 175.0;
		constexpr double MaxSpeed = 640.0;
		constexpr double Acceleration = 3800.0;
		constexpr double Deceleration = 5200.0;
		constexpr double BaseHealth = 100.0;
	}

	namespace Thread
	{
		constexpr double Max = 100.0;
		constexpr double RoomStart = 50.0;
		constexpr double RegenPerSecond = 4.0;
	}

	namespace Draught
	{
		constexpr int32_t Charges = 4;
		constexpr double Heal = 35.0;
		constexpr double Lock = 0.25;
		constexpr double Cooldown = 1.0;
		constexpr double NormalRestoreChance = 0.07;

		/** Normal enemy: 7% roll. Elite: guaranteed when below max. Never exceeds max. */
		inline bool RestoresCharge(bool bElite, int32_t Current, FRunRandom& Rng)
		{
			if (Current >= Charges) return false;
			return bElite ? true : Rng.Chance(NormalRestoreChance);
		}
	}

	// ----------------------------------------------------------- ability timing

	/** Windup → Active → Recovery. Cancel times are measured from ability start; <0 means none. */
	struct FAbilityTiming
	{
		double Windup = 0;
		double Active = 0;
		double Recovery = 0;
		double EvadeCancelAt = -1;
		double SkillCancelAt = -1;
		double MoveMulWindup = 1;
		double MoveMulActive = 1;
		double MoveMulRecovery = 1;

		double Total() const { return Windup + Active + Recovery; }
		bool CanDealDamageAt(double T) const { return T >= Windup && T < Windup + Active; }
	};

	enum class EAbilityId : uint8_t
	{
		ThreadLash,
		Sever,
		Bind,
		Unravel,
		WardingSigil,
		GrandFracture,
		Evade,
		Count
	};

	inline FAbilityTiming DefaultTiming(EAbilityId Id)
	{
		FAbilityTiming T;
		switch (Id)
		{
		case EAbilityId::ThreadLash:
			T = {0.11, 0.12, 0.19, 0.16, 0.31, 0.70, 0.45, 0.80};
			break;
		case EAbilityId::Sever:
			// Active movement is the motion-warped lunge; the multiplier only applies outside it.
			T = {0.18, 0.15, 0.28, 0.33, 0.47, 0.45, 0.0, 0.65};
			break;
		case EAbilityId::Bind:
			T = {0.20, 0.08, 0.20, -1, -1, 0.5, 0.5, 0.7};
			break;
		case EAbilityId::Unravel:
			T = {0.24, 0.34, 0.20, -1, -1, 0.5, 0.5, 0.7};
			break;
		case EAbilityId::WardingSigil:
			// Cast lock only: the Barrier outlives the ability.
			T = {0.0, 0.17, 0.0, -1, -1, 1.0, 0.0, 1.0};
			break;
		case EAbilityId::GrandFracture:
			T = {0.48, 0.36, 0.34, -1, -1, 0.0, 0.0, 0.4};
			break;
		case EAbilityId::Evade:
			T = {0.0, 0.34, 0.0, -1, -1, 1, 1, 1};
			break;
		default:
			break;
		}
		return T;
	}

	inline double DefaultCooldown(EAbilityId Id)
	{
		switch (Id)
		{
		case EAbilityId::Bind: return 11.0;
		case EAbilityId::Unravel: return 7.5;
		case EAbilityId::WardingSigil: return 14.0;
		case EAbilityId::GrandFracture: return 38.0;
		case EAbilityId::Evade: return 1.65;
		default: return 0.0;
		}
	}

	// ---------------------------------------------------------------- abilities

	namespace ThreadLash
	{
		constexpr double Range = 320.0;
		constexpr double ArcDegrees = 100.0;
		constexpr double Damage = 32.0;
		constexpr double ThreadGain = 14.0;
		constexpr double ComboWindow = 1.2;
		constexpr double ComboDamage = 44.0;
		constexpr double ComboStagger = 8.0;
		constexpr double ComboThreadGain = 18.0;
	}

	/**
	 * Counts consecutive Lashes. The third Lash whose start is within ComboWindow
	 * of the previous Lash's start is the empowered one; the chain then restarts.
	 * Any other ability breaks the chain.
	 */
	struct FLashCombo
	{
		int32_t Count = 0;
		double LastStart = -1e9;

		/** Returns true when this Lash is the empowered third strike. */
		bool OnLash(double Now)
		{
			Count = (Now - LastStart <= ThreadLash::ComboWindow) ? Count + 1 : 1;
			LastStart = Now;
			if (Count >= 3)
			{
				Count = 0;
				return true;
			}
			return false;
		}

		void Break() { Count = 0; LastStart = -1e9; }
	};

	namespace Sever
	{
		constexpr double ThreadCost = 30.0;
		constexpr double Range = 470.0;
		constexpr double ConeDegrees = 68.0;
		constexpr double Damage = 118.0;
		constexpr double Stagger = 16.0;
		constexpr double Lunge = 65.0;
	}

	namespace Bind
	{
		constexpr double Radius = 550.0;
		constexpr double Damage = 22.0;
		constexpr double NormalPull = 260.0;
		constexpr double NormalRoot = 1.2;
		constexpr double ElitePull = 80.0;
		constexpr double EliteSlow = 0.35;
		constexpr double EliteDuration = 1.2;
		constexpr double EliteStagger = 20.0;
		constexpr double BossStagger = 22.0;
	}

	namespace Unravel
	{
		constexpr double StartRadius = 100.0;
		constexpr double EndRadius = 530.0;
		constexpr double Expansion = 0.34;
		constexpr double Damage = 86.0;
		constexpr double Stagger = 12.0;

		/** Radius at T seconds after expansion starts. Continuous; the damage query uses exactly this. */
		inline double RadiusAt(double T) { return StartRadius + (EndRadius - StartRadius) * Clamp01(T / Expansion); }
	}

	namespace WardingSigil
	{
		constexpr double BarrierFractionOfMaxHealth = 0.35;
		constexpr double Duration = 3.5;
	}

	namespace GrandFracture
	{
		constexpr double StrikeDistances[3] = {250.0, 450.0, 650.0};
		constexpr double StrikeDelay = 0.11;
		constexpr double StrikeRadius = 180.0;
		constexpr double Damage = 96.0;
		constexpr double Stagger = 24.0;

		/** Seconds after Active begins at which strike i lands. */
		inline double StrikeTime(int32_t Index) { return StrikeDelay * Index; }
	}

	// -------------------------------------------------------------------- evade

	namespace Evade
	{
		constexpr double Distance = 460.0;
		constexpr double Duration = 0.34;
		constexpr double InvulnStart = 0.055;
		constexpr double InvulnEnd = 0.255;
		constexpr double InputThreshold = 0.25;
		/** Speed at t=0 as a fraction of peak, so velocity changes on the very next movement tick. */
		constexpr double StartSpeedFraction = 0.35;
		constexpr double AccelEnd = 0.20;
		constexpr double DecelStart = 0.65;

		/** Speed as a fraction of peak at normalised time A ∈ [0,1]: ramp 0–20%, hold 20–65%, ramp down 65–100%. */
		inline double SpeedFraction(double A)
		{
			A = Clamp01(A);
			if (A < AccelEnd) return StartSpeedFraction + (1.0 - StartSpeedFraction) * (A / AccelEnd);
			if (A <= DecelStart) return 1.0;
			return 1.0 - (A - DecelStart) / (1.0 - DecelStart);
		}

		/** Unnormalised integral of SpeedFraction from 0 to A (closed form). */
		inline double RawDistance(double A)
		{
			A = Clamp01(A);
			const double S0 = StartSpeedFraction;
			const double Accel = std::min(A, AccelEnd);
			double D = S0 * Accel + (1.0 - S0) * Accel * Accel / (2.0 * AccelEnd);
			if (A > AccelEnd) D += std::min(A, DecelStart) - AccelEnd;
			if (A > DecelStart)
			{
				const double X = A - DecelStart;
				D += X - X * X / (2.0 * (1.0 - DecelStart));
			}
			return D;
		}

		/** Fraction of the total 460 cm covered by normalised time A. DistanceFraction(1) == 1. */
		inline double DistanceFraction(double A) { return RawDistance(A) / RawDistance(1.0); }

		/** Peak speed in cm/s implied by Distance and Duration. */
		inline double PeakSpeed() { return Distance / (Duration * RawDistance(1.0)); }

		inline bool IsInvulnerableAt(double T) { return T >= InvulnStart && T < InvulnEnd; }

		/** Movement input direction if its magnitude reaches the threshold, else facing. 2D, not normalised on input. */
		inline void ChooseDirection(double InX, double InY, double FaceX, double FaceY, double& OutX, double& OutY)
		{
			const double Mag = std::sqrt(InX * InX + InY * InY);
			if (Mag >= InputThreshold)
			{
				OutX = InX / Mag;
				OutY = InY / Mag;
				return;
			}
			const double F = std::sqrt(FaceX * FaceX + FaceY * FaceY);
			OutX = F > 0 ? FaceX / F : 1.0;
			OutY = F > 0 ? FaceY / F : 0.0;
		}
	}

	// ------------------------------------------------------------------- damage

	namespace Damage
	{
		constexpr double BaseCritChance = 0.05;
		constexpr double BaseCritMultiplier = 1.50;
		constexpr double StaggeredBossBonus = 0.25;

		inline double ArmorMultiplier(double Armor) { return 100.0 / (100.0 + std::max(0.0, Armor)); }

		struct FResult
		{
			double Amount = 0;
			bool bCrit = false;
		};

		/**
		 * rawDamage = base × gear × temporary; no random ranges. Crit is a deterministic draw
		 * from the run's crit stream. Mitigation 100/(100+armor). Bonus taken (e.g. staggered
		 * boss +25%) multiplies last.
		 */
		inline FResult Compute(double BaseAbilityDamage, double GearMultiplier, double TemporaryMultiplier,
			double CritChance, double CritMultiplier, double TargetArmor, double DamageTakenBonus, FRunRandom& CritRng)
		{
			FResult R;
			double Raw = BaseAbilityDamage * GearMultiplier * TemporaryMultiplier;
			R.bCrit = CritRng.Chance(Clamp01(CritChance));
			if (R.bCrit) Raw *= CritMultiplier;
			R.Amount = Raw * ArmorMultiplier(TargetArmor) * (1.0 + DamageTakenBonus);
			return R;
		}

		/** Barrier absorbs first. Returns health damage; updates Barrier in place. */
		inline double AbsorbWithBarrier(double Incoming, double& Barrier)
		{
			const double Absorbed = std::min(Barrier, Incoming);
			Barrier -= Absorbed;
			return Incoming - Absorbed;
		}
	}

	// ----------------------------------------------------------------- hit feel

	struct FHitFeel
	{
		double EnemyFlash = 0;       // s
		double EnemyAnimPause = 0;   // s (local, per-actor)
		double GlobalHitstop = 0;    // s (world time only; UI/audio keep running)
		double CameraTranslation = 0; // cm
		double CameraRotation = 0;   // deg
		double ShakeDecay = 0;       // s
	};

	enum class EHitWeight : uint8_t { Normal, Heavy, Ultimate };

	/**
	 * Normal: no hitstop. Heavy: local anim pause; global hitstop only when it also crits.
	 * Ultimate: only the ability's first successful impact gets the big kick.
	 */
	inline FHitFeel HitFeelFor(EHitWeight Weight, bool bCrit, bool bFirstUltimateImpact)
	{
		switch (Weight)
		{
		case EHitWeight::Heavy:
			return {0.080, 0.035, bCrit ? 0.028 : 0.0, 5.5, 0.25, 0.110};
		case EHitWeight::Ultimate:
			if (bFirstUltimateImpact) return {0.080, 0.035, 0.042, 10.0, 0.45, 0.160};
			return {0.080, 0.035, bCrit ? 0.028 : 0.0, 5.5, 0.25, 0.110}; // later impacts feel like heavy hits
		default:
			return {0.055, 0.0, 0.0, 2.5, 0.10, 0.080};
		}
	}

	// -------------------------------------------------------------- telegraphs

	enum class ETelegraphClass : uint8_t { MinorMelee, FastLeap, Projectile, Heavy, DangerZone, BossMajor, BossLethal };

	inline double TelegraphMinimum(ETelegraphClass C)
	{
		switch (C)
		{
		case ETelegraphClass::MinorMelee: return 0.40;
		case ETelegraphClass::FastLeap: return 0.55;
		case ETelegraphClass::Projectile: return 0.60;
		case ETelegraphClass::Heavy: return 0.80;
		case ETelegraphClass::DangerZone: return 0.80;
		case ETelegraphClass::BossMajor: return 0.95;
		case ETelegraphClass::BossLethal: return 1.20;
		}
		return 0.40;
	}

	constexpr double TelegraphSpatialTolerance = 20.0;  // cm
	constexpr double TelegraphTemporalTolerance = 0.050; // s

	/** Visual region and damage region must agree within 20 cm and 50 ms. */
	inline bool TelegraphMatches(double VisualRadius, double DamageRadius, double VisualEnd, double DamageTime)
	{
		return std::fabs(VisualRadius - DamageRadius) <= TelegraphSpatialTolerance &&
			std::fabs(VisualEnd - DamageTime) <= TelegraphTemporalTolerance;
	}

	// --------------------------------------------------------- off-screen rule

	namespace Fairness
	{
		constexpr double ViewportMargin = 0.08;
		constexpr double OffscreenWarningMinimum = 0.70;

		/** Screen position normalised to [0,1]² (may lie outside). True if inside viewport grown by 8% per side. */
		inline bool InsideViewportWithMargin(double U, double V)
		{
			return U >= -ViewportMargin && U <= 1.0 + ViewportMargin && V >= -ViewportMargin && V <= 1.0 + ViewportMargin;
		}

		/**
		 * May a normal enemy begin an attack windup? Off-screen it needs a warning that has
		 * already been visible for ≥0.70 s. The MVP has no off-screen warnings, so ordinary
		 * enemies pass WarningAge < 0 and simply wait.
		 */
		inline bool MayBeginAttack(bool bBossOrScripted, double U, double V, double WarningAge)
		{
			if (bBossOrScripted) return true;
			if (InsideViewportWithMargin(U, V)) return true;
			return WarningAge >= OffscreenWarningMinimum;
		}
	}

	// ---------------------------------------------------------- damage numbers

	namespace DamageNumbers
	{
		constexpr int32_t MaxSimultaneous = 18;
		constexpr double Lifetime = 0.65;
		constexpr double NormalSizePx = 18;
		constexpr double CritSizePx = 23;
	}
}
