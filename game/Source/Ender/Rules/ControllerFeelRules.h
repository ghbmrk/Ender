// Ender — platform-fighter controller feel (shared hitlag, knockback, directional influence).
//
// These are genre techniques found in open platform fighters (see docs/THIRD_PARTY.md,
// "Reference only"); no code or numbers were copied. Every constant here is Ender's own,
// sized against Ender's damage range (enemy hits 10–30, Binder skills 22–118).
//
// Shared hitlag: on a connecting hit the attacker and the victim both freeze for the same
// short time, longer for bigger hits. The attack's montage (and so its notify windows)
// pauses with it, so the swing reads as biting into the target. Presses made during the
// freeze stay in the input buffer, which outlives the longest hitlag.
//
// Knockback with directional influence: when the Binder is hit it is pushed away from the
// attacker; the move stick held perpendicular to that push bends it by up to MaxDIDegrees.
#pragma once

#include <algorithm>
#include <cmath>

#include "Rules/CombatRules.h"
#include "Rules/InputBufferCore.h"

namespace EnderRules::ControllerFeel
{
	constexpr double HitlagBase = 0.025;      // s
	constexpr double HitlagPerDamage = 0.0006; // s per point of damage
	constexpr double HitlagHeavyBonus = 0.015; // s
	constexpr double HitlagMax = 0.100;        // s; below InputBufferLifetime so no press is lost

	static_assert(HitlagMax < InputBufferLifetime, "a buffered press must survive the longest hitlag");

	/** Freeze applied to attacker and victim alike. Zero for a hit that dealt nothing. */
	inline double SharedHitlag(double Damage, EHitWeight Weight)
	{
		if (Damage <= 0) return 0;
		double T = HitlagBase + HitlagPerDamage * Damage;
		if (Weight != EHitWeight::Normal) T += HitlagHeavyBonus;
		return std::min(T, HitlagMax);
	}

	constexpr double KnockbackBaseSpeed = 300.0;    // cm/s
	constexpr double KnockbackSpeedPerDamage = 15.0; // cm/s per point of health lost
	constexpr double KnockbackMaxSpeed = 900.0;     // cm/s

	/** Ground speed the Binder is pushed at; friction then slides it to a stop during hit-stun. */
	inline double KnockbackSpeed(double HealthLost)
	{
		if (HealthLost <= 0) return 0;
		return std::min(KnockbackBaseSpeed + KnockbackSpeedPerDamage * HealthLost, KnockbackMaxSpeed);
	}

	constexpr double MaxDIDegrees = 15.0;
	constexpr double Pi = 3.14159265358979323846;

	struct FVec2
	{
		double X = 0, Y = 0;
	};

	/**
	 * Bend a launch direction by the stick. Only the stick's component perpendicular to the
	 * launch counts (holding along or against it does nothing), scaled to at most MaxDIDegrees.
	 * Launch must be non-zero; Stick is the move input clamped to the unit circle.
	 */
	inline FVec2 ApplyDI(FVec2 Launch, FVec2 Stick)
	{
		const double Len = std::hypot(Launch.X, Launch.Y);
		if (Len <= 0) return Launch;
		const FVec2 L{Launch.X / Len, Launch.Y / Len};
		const double StickLen = std::hypot(Stick.X, Stick.Y);
		if (StickLen > 1.0) Stick = {Stick.X / StickLen, Stick.Y / StickLen};
		// z of Launch × Stick: signed perpendicular component, −1..1.
		const double Perp = L.X * Stick.Y - L.Y * Stick.X;
		const double Angle = Perp * MaxDIDegrees * Pi / 180.0;
		const double C = std::cos(Angle), S = std::sin(Angle);
		return {(L.X * C - L.Y * S) * Len, (L.X * S + L.Y * C) * Len};
	}
}
