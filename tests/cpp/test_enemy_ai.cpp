// Enemy AI support rules (Rules/EnemyAIRules.h). Runs from a static initialiser
// and reports through test_main.cpp's Check(), so main's totals include it.
#include <cmath>
#include <cstdio>

#include "Rules/EnemyAIRules.h"

using namespace EnderRules;

void Check(bool bCond, const char* What);

namespace
{
	bool Near(double A, double B, double Eps) { return std::fabs(A - B) <= Eps; }

	void RunEnemyAITests()
	{
		// Telegraph look: windup fill 25%, activation at exactly Duration → 55% with a 70 ms cream flash.
		const TelegraphLook::FState Mid = TelegraphLook::At(0.2, 0.43);
		Check(!Mid.bActivated && Near(Mid.Fill, 0.25, 1e-9) && Mid.Flash == 0, "telegraph windup look");
		const TelegraphLook::FState Hit = TelegraphLook::At(0.43, 0.43);
		Check(Hit.bActivated && Near(Hit.Fill, 0.55, 1e-9) && Hit.Flash == 1 && Near(Hit.Progress, 1, 1e-9), "telegraph activates at its duration");
		Check(TelegraphLook::At(0.43 + 0.069, 0.43).Flash == 1 && TelegraphLook::At(0.43 + 0.071, 0.43).Flash == 0, "cream flash lasts 70 ms");
		Check(Near(TelegraphLook::EffectiveDuration(0.30, ETelegraphClass::MinorMelee), 0.40, 1e-9), "telegraph floor enforced");
		Check(Near(TelegraphLook::EffectiveDuration(0.92, ETelegraphClass::Heavy), 0.92, 1e-9), "authored telegraph above floor kept");

		// Every archetype's default telegraph already meets its class floor.
		for (int32_t A = 0; A < NumArchetypes; ++A)
		{
			const FArchetypeStats S = DefaultStats(static_cast<EArchetype>(A));
			Check(S.Primary.Telegraph >= TelegraphMinimum(S.Primary.Class), "primary telegraph meets floor");
			if (S.bHasHeavy) Check(S.Heavy.Telegraph >= TelegraphMinimum(S.Heavy.Class), "heavy telegraph meets floor");
		}

		// Seer hazard: 7/s for 3.5 s in 0.5 s slices = 24.5 total, first slice at 0.20 s activation.
		const int32_t Ticks = HazardTicks::Count(Seer::HazardDuration);
		Check(Ticks == 7, "seer hazard tick count");
		Check(Near(Ticks * HazardTicks::DamagePerTick(Seer::HazardDps), Seer::HazardDps * Seer::HazardDuration, 1e-9), "seer hazard total damage");
		Check(Near(HazardTicks::TickTime(Seer::ActivationDelay, 0), 0.20, 1e-9), "first hazard tick at activation");
		Check(HazardTicks::TickTime(Seer::ActivationDelay, Ticks - 1) < Seer::ActivationDelay + Seer::HazardDuration, "last hazard tick inside duration");

		// Bound King health lands the first kill inside 75–110 s across the expected gear range.
		Check(Near(BossTuning::RotationDps(), 157.7, 0.5), "binder rotation dps model");
		for (double Gear = 1.2; Gear <= 1.4 + 1e-9; Gear += 0.05)
		{
			const double T = BossTuning::FirstKillSeconds(BossTuning::MaxHealth, Gear, false);
			Check(T >= BoundKing::FirstKillTargetMin && T <= BoundKing::FirstKillTargetMax, "boss first kill within 75-110 s");
		}
		const double Tutorial = BossTuning::FirstKillSeconds(BossTuning::MaxHealth * BossTuning::TutorialHealthScale, 1.0, true);
		Check(Tutorial >= BoundKing::FirstKillTargetMin && Tutorial <= BoundKing::FirstKillTargetMax, "tutorial boss kill within 75-110 s");
		std::printf("  boss first kill: gear 1.2 %.1f s · gear 1.4 %.1f s · tutorial %.1f s\n",
			BossTuning::FirstKillSeconds(BossTuning::MaxHealth, 1.2, false),
			BossTuning::FirstKillSeconds(BossTuning::MaxHealth, 1.4, false), Tutorial);
	}

	struct FRunAtStartup
	{
		FRunAtStartup()
		{
			std::printf("enemy AI rules\n");
			RunEnemyAITests();
		}
	} RunAtStartup;
}
