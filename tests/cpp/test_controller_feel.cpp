// Tests for the platform-fighter controller-feel rules (shared hitlag, knockback, DI).
// Runs at static-init time through the shared Check() in test_main.cpp.
#include <cmath>
#include <cstdio>

#include "Rules/ControllerFeelRules.h"

using namespace EnderRules;
using namespace EnderRules::ControllerFeel;

void Check(bool bCond, const char* What);

namespace
{
	bool Near(double A, double B, double Eps = 1e-9) { return std::fabs(A - B) <= Eps; }
	double Deg(FVec2 V) { return std::atan2(V.Y, V.X) * 180.0 / Pi; }

	void HitlagScalesAndCaps()
	{
		Check(SharedHitlag(0, EHitWeight::Heavy) == 0, "no damage, no hitlag");
		Check(Near(SharedHitlag(32, EHitWeight::Normal), 0.0442), "Lash hitlag 44 ms");
		Check(SharedHitlag(118, EHitWeight::Heavy) == HitlagMax, "Sever hits the cap");
		Check(SharedHitlag(40, EHitWeight::Heavy) > SharedHitlag(40, EHitWeight::Normal), "heavy freezes longer");
		double Prev = 0;
		bool bMonotonic = true;
		for (int D = 1; D <= 300; ++D)
		{
			const double T = SharedHitlag(D, EHitWeight::Ultimate);
			bMonotonic = bMonotonic && T >= Prev && T <= HitlagMax;
			Prev = T;
		}
		Check(bMonotonic, "hitlag never shrinks with damage and never passes the cap");
	}

	void PressDuringHitlagSurvives()
	{
		TInputBufferCore<8> Buffer;
		Buffer.Push(2, EInputPriority::Skill, 1.0); // pressed on the frame of impact
		Check(Buffer.Peek(1.0 + HitlagMax) == 2, "press made at impact is still live when the longest hitlag ends");
	}

	void KnockbackScalesAndCaps()
	{
		Check(KnockbackSpeed(0) == 0, "no health lost, no push");
		Check(Near(KnockbackSpeed(10), 450), "Husk hit pushes at 450 cm/s");
		Check(KnockbackSpeed(1000) == KnockbackMaxSpeed, "capped");
	}

	void DIBendsOnlyPerpendicular()
	{
		const FVec2 East{1, 0};
		Check(Near(Deg(ApplyDI(East, {0, 0})), 0), "no stick, no bend");
		Check(Near(Deg(ApplyDI(East, {1, 0})), 0), "holding along the launch does nothing");
		Check(Near(Deg(ApplyDI(East, {-1, 0})), 0), "holding against the launch does nothing");
		Check(Near(Deg(ApplyDI(East, {0, 1})), MaxDIDegrees), "full perpendicular gives the full bend");
		Check(Near(Deg(ApplyDI(East, {0, -1})), -MaxDIDegrees), "other side bends the other way");
		Check(Near(Deg(ApplyDI(East, {0, 5})), MaxDIDegrees), "over-range stick is clamped");
		const FVec2 Out = ApplyDI({300, 400}, {-0.8, 0.6});
		Check(Near(std::hypot(Out.X, Out.Y), 500, 1e-6), "DI keeps launch speed");
		Check(Near(Deg(ApplyDI({0, 1}, {1, 0})), 90 - MaxDIDegrees), "rotation is relative to the launch");
	}

	struct FRun
	{
		FRun()
		{
			HitlagScalesAndCaps();
			PressDuringHitlagSurvives();
			KnockbackScalesAndCaps();
			DIBendsOnlyPerpendicular();
			std::printf("ran  ControllerFeel (shared hitlag, knockback, DI)\n");
		}
	} Run;
}
