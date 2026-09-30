// Tests for the client-side engine-free rules: damage numbers, telemetry
// warnings, Realm flow, Focus, Form pool percentiles and offline loot.
// Runs at static-init time through the shared Check() in test_main.cpp.
#include <cmath>
#include <cstdio>
#include <vector>

#include "Rules/DamageNumberRules.h"
#include "Rules/RealmFlowRules.h"
#include "Rules/TelemetryRules.h"

using namespace EnderRules;

void Check(bool bCond, const char* What);

namespace
{
	bool Near(double A, double B, double Eps = 1e-9) { return std::fabs(A - B) <= Eps; }

	void DamageNumbersCapAndAggregate()
	{
		DamageNumbers::FQueue Q;
		for (int I = 0; I < 18; ++I) Q.Push(static_cast<uint32_t>(I), 10, false, 1, 0, 0, 0);
		Check(Q.Live.size() == 18, "18 numbers live");
		// Same target, same frame, over the cap: aggregates, count unchanged.
		const uint32_t Id = Q.Push(3, 5, true, 1, 0, 0, 0);
		Check(Q.Live.size() == 18, "aggregation keeps the cap");
		bool bFound = false;
		for (const auto& E : Q.Live)
			if (E.Id == Id) bFound = Near(E.Amount, 15) && E.bCrit && E.Hits == 2;
		Check(bFound, "same-frame repeated hit folded into one number");
		// A different frame over the cap evicts the oldest instead.
		Q.Tick(0.1);
		Q.Push(99, 7, false, 2, 0, 0, 0);
		Check(Q.Live.size() == 18, "never more than 18 simultaneous");
		Q.Tick(0.56);
		Check(Q.Live.size() == 1, "0.65 s lifetime expires the older numbers");
		Q.Tick(0.2);
		Check(Q.Live.empty(), "all numbers expire");
		Check(Near(DamageNumbers::NormalSizePx, 18) && Near(DamageNumbers::CritSizePx, 23), "damage number sizes");
	}

	void TelemetryWarnings()
	{
		using namespace TelemetryRules;
		Check(Near(Median({3, 1, 2}), 2) && Near(Median({4, 1, 2, 3}), 2.5), "median");
		auto W = Evaluate({50, 10, 10, 10, 10, 2}, {60, 58, 70}, 1, {160, 170});
		int Under = 0, Over = 0, Slow = 0, Off = 0, Boss = 0;
		for (const auto& X : W)
		{
			Under += X.Kind == EWarning::SkillUnderused;
			Over += X.Kind == EWarning::SkillOverused;
			Slow += X.Kind == EWarning::RoomsTooSlow;
			Off += X.Kind == EWarning::OffscreenHits;
			Boss += X.Kind == EWarning::BossTooSlow;
		}
		Check(Under == 1 && Over == 1 && Slow == 1 && Off == 1 && Boss == 1, "telemetry warnings fire");
		Check(Evaluate({10, 10, 10, 10, 10, 10}, {30, 35}, 0, {120}).empty(), "healthy session has no warnings");
		auto Fast = Evaluate({}, {10, 12, 14}, 0, {});
		Check(Fast.size() == 1 && Fast[0].Kind == EWarning::RoomsTooFast, "rooms too fast");
	}

	void RealmSequenceAndFocus()
	{
		const ERealmSegment Expected[] = {ERealmSegment::Entry, ERealmSegment::Room1, ERealmSegment::Connector, ERealmSegment::Room2,
			ERealmSegment::AttunementShrine, ERealmSegment::Room3, ERealmSegment::Room4, ERealmSegment::Elite,
			ERealmSegment::RecoverySpace, ERealmSegment::Boss, ERealmSegment::RewardAltar, ERealmSegment::ReturnPortal};
		ERealmSegment S = ERealmSegment::Entry;
		bool bOk = true;
		for (int I = 0; I < 12; ++I)
		{
			bOk &= S == Expected[I];
			S = RealmFlow::Next(S);
		}
		Check(bOk && S == ERealmSegment::ReturnPortal, "Realm sequence is exact");
		ERoomKind K;
		Check(RealmFlow::RoomKindFor(ERealmSegment::Elite, K) && K == ERoomKind::Elite, "elite segment maps to elite room");
		Check(!RealmFlow::RoomKindFor(ERealmSegment::Boss, K), "boss is not an encounter room");

		FFocusWallet F;
		Check(F.Current == 12, "12 Focus per Realm");
		Check(F.TrySpend(EFamiliarAction::DeepTrial) && F.Current == 9, "Deep Trial costs 3");
		Check(F.TrySpend(EFamiliarAction::Temper) && F.TrySpend(EFamiliarAction::Mirror) && F.Current == 5, "Temper, Mirror cost 2");
		Check(F.TrySpend(EFamiliarAction::Attune) && F.TrySpend(EFamiliarAction::Fracture) && F.Current == 3, "Attune, Fracture cost 1");
		Check(F.TrySpend(EFamiliarAction::DeepTrial) && !F.TrySpend(EFamiliarAction::Attune), "cannot overspend");
		F.Refresh();
		Check(F.Current == 12, "Focus refreshes each Realm");

		FPacingLog P;
		P.Add(ERealmSegment::Room1, 35);
		P.Add(ERealmSegment::Connector, 15);
		Check(Near(P.CombatShare(), 0.7), "combat share recorded");
	}

	void PoolAndOffline()
	{
		auto R = FormPool::PercentileRanks({10, 30, 20, 30});
		Check(Near(R[0], 0) && Near(R[2], 100.0 / 3) && Near(R[1], 100.0 * 2.5 / 3) && Near(R[3], R[1]), "percentile ranks with ties");
		Check(FormPool::SeedFromString("char-1:3") == FormPool::SeedFromString("char-1:3") &&
			FormPool::SeedFromString("char-1:3") != FormPool::SeedFromString("char-1:4"), "seed hash deterministic");
		FRunRandom Rng(9);
		bool bInBand = true;
		for (int I = 0; I < 1000; ++I)
		{
			const double P = OrdinaryLoot::RollPower(EDropSource::Boss, Rng);
			bInBand &= P >= 50 && P <= 70;
		}
		Check(bInBand, "ordinary loot power stays in band");
	}

	struct FRunAtStartup
	{
		FRunAtStartup()
		{
			DamageNumbersCapAndAggregate();
			TelemetryWarnings();
			RealmSequenceAndFocus();
			PoolAndOffline();
			std::printf("ran  ClientRules (damage numbers, telemetry, realm flow, focus, pool)\n");
		}
	} RunAtStartup;
}
