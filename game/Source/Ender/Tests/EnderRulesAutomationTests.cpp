// In-engine automation tests (Session Frontend → Automation, filter "Ender.").
// They run the same engine-free rules as tests/cpp so the numbers are checked
// inside the shipped module, plus the §94 seeded-room simulation.
#include "Misc/AutomationTest.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "Rules/BossRules.h"
#include "Rules/CombatRules.h"
#include "Rules/EnemyRules.h"
#include "Rules/InputBufferCore.h"
#include "Rules/RoomSimulation.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FEnderSeededRoomsTest, "Ender.Rules.SeededRooms",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)

bool FEnderSeededRoomsTest::RunTest(const FString& Parameters)
{
	const EnderRules::FRoomSimTotals T = EnderRules::SimulateSeededRooms(100);
	TestEqual(TEXT("rooms"), T.Rooms, 100);
	TestEqual(TEXT("invalid plans"), T.PlanInvalid, 0);
	TestEqual(TEXT("prohibited spawns"), T.ProhibitedSpawns, 0);
	TestEqual(TEXT("token cap violations"), T.TokenViolations, 0);
	TestEqual(TEXT("off-screen normal attack starts"), T.OffscreenStarts, 0);
	TestEqual(TEXT("off-screen normal attack hits"), T.OffscreenHits, 0);
	TestEqual(TEXT("enemy cap violations"), T.CapViolations, 0);
	TestTrue(TEXT("enemies attacked"), T.Attacks > 1000);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FEnderAbilityTimingTest, "Ender.Rules.AbilityTiming",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)

bool FEnderAbilityTimingTest::RunTest(const FString& Parameters)
{
	using namespace EnderRules;
	TestEqual(TEXT("Thread Lash total"), DefaultTiming(EAbilityId::ThreadLash).Total(), 0.42, 1e-9);
	TestEqual(TEXT("Sever total"), DefaultTiming(EAbilityId::Sever).Total(), 0.61, 1e-9);
	for (int32 I = 0; I < static_cast<int32>(EAbilityId::Count); ++I)
	{
		const FAbilityTiming Timing = DefaultTiming(static_cast<EAbilityId>(I));
		for (double X = 0; X < Timing.Windup; X += 0.005) TestFalse(TEXT("no damage in windup"), Timing.CanDealDamageAt(X));
	}
	TestEqual(TEXT("evade distance"), Evade::PeakSpeed() * Evade::Duration * Evade::RawDistance(1.0), 460.0, 1e-6);
	TestEqual(TEXT("unravel mid radius"), Unravel::RadiusAt(0.17), 315.0, 1e-9);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FEnderInputBufferTest, "Ender.Rules.InputBuffer",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)

bool FEnderInputBufferTest::RunTest(const FString& Parameters)
{
	using namespace EnderRules;
	TInputBufferCore<8> B;
	B.Push(0, EInputPriority::Basic, 0.0);
	B.Push(6, EInputPriority::Evade, 0.01);
	TestEqual(TEXT("evade first"), B.Peek(0.05), 6);
	B.Consume(6);
	TestEqual(TEXT("expires after 120 ms"), B.Peek(0.121), -1);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FEnderBossTest, "Ender.Rules.BoundKing",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)

bool FEnderBossTest::RunTest(const FString& Parameters)
{
	using namespace EnderRules;
	FBoundKingState K;
	K.MaxHealth = K.Health = 1000;
	K.ApplyHit(300, 0);
	TestEqual(TEXT("phase 2 at 70%"), K.Phase, 2);
	TestTrue(TEXT("safe during transition"), K.IsInvulnerable());
	K.Tick(2.0);
	for (int32 I = 0; I < 5; ++I) K.ApplyHit(1, 20);
	TestTrue(TEXT("stagger breaks at 100"), K.IsStaggered());
	TestEqual(TEXT("+25% while staggered"), K.ApplyHit(10, 0).Applied, 12.5, 1e-9);
	return true;
}

#endif
