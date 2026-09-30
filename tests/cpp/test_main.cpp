// Standalone tests for the engine-free rules in game/Source/Ender/Rules.
// Build and run: tests/cpp/run.sh   (g++ or clang++, C++20, no Unreal needed)
#include <cmath>
#include <cstdio>
#include <functional>
#include <string>
#include <vector>

#include "Rules/BossRules.h"
#include "Rules/CombatRules.h"
#include "Rules/EncounterRules.h"
#include "Rules/EnemyRules.h"
#include "Rules/InputBufferCore.h"
#include "Rules/LootRules.h"
#include "Rules/RunRandom.h"

using namespace EnderRules;

static int Failures = 0;
static int Checks = 0;
static std::vector<std::pair<std::string, std::function<void()>>>& Registry()
{
	static std::vector<std::pair<std::string, std::function<void()>>> R;
	return R;
}
struct FReg
{
	FReg(const char* N, std::function<void()> F) { Registry().push_back({N, F}); }
};
#define TEST(Name) static void Name(); static FReg Reg_##Name(#Name, Name); static void Name()
#define CHECK(Cond) do { ++Checks; if (!(Cond)) { ++Failures; std::printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #Cond); } } while (0)
#define NEAR(A, B, Eps) CHECK(std::fabs((A) - (B)) <= (Eps))

void RunSeededRoomsTest(); // test_rooms.cpp

TEST(RngIsDeterministicAndStreamsIndependent)
{
	FRunRandom A = FRunRandom::Derive(42, Stream::Crit), B = FRunRandom::Derive(42, Stream::Crit);
	for (int I = 0; I < 100; ++I) CHECK(A.NextU64() == B.NextU64());
	FRunRandom C = FRunRandom::Derive(42, Stream::Loot);
	CHECK(FRunRandom::Derive(42, Stream::Crit).NextU64() != C.NextU64());
	FRunRandom R(7);
	for (int I = 0; I < 1000; ++I)
	{
		const int V = R.RangeInt(5, 8);
		CHECK(V >= 5 && V <= 8);
	}
}

TEST(AbilityTimingsMatchSpec)
{
	const FAbilityTiming Lash = DefaultTiming(EAbilityId::ThreadLash);
	NEAR(Lash.Total(), 0.42, 1e-9);
	CHECK(!Lash.CanDealDamageAt(0.10));
	CHECK(Lash.CanDealDamageAt(0.11));
	CHECK(!Lash.CanDealDamageAt(0.23));
	NEAR(DefaultTiming(EAbilityId::Sever).Total(), 0.61, 1e-9);
	NEAR(DefaultTiming(EAbilityId::GrandFracture).Total(), 1.18, 1e-9);
	NEAR(DefaultCooldown(EAbilityId::Evade), 1.65, 1e-9);
	// Damage can never land during windup, for any ability.
	for (int I = 0; I < static_cast<int>(EAbilityId::Count); ++I)
	{
		const FAbilityTiming T = DefaultTiming(static_cast<EAbilityId>(I));
		for (double X = 0; X < T.Windup; X += 0.005) CHECK(!T.CanDealDamageAt(X));
	}
}

TEST(LashComboEmpowersEveryThird)
{
	FLashCombo C;
	CHECK(!C.OnLash(0.0));
	CHECK(!C.OnLash(0.35));
	CHECK(C.OnLash(0.70));
	CHECK(!C.OnLash(1.05));
	CHECK(!C.OnLash(3.00)); // gap > 1.2 s restarts the chain
	CHECK(!C.OnLash(3.40));
	CHECK(C.OnLash(3.80));
}

TEST(EvadeCurveCoversExactDistance)
{
	NEAR(Evade::DistanceFraction(0), 0, 1e-12);
	NEAR(Evade::DistanceFraction(1), 1, 1e-12);
	// Monotone, and the numerical integral of SpeedFraction matches the closed form.
	double Prev = 0, Numeric = 0;
	const int N = 20000;
	for (int I = 1; I <= N; ++I)
	{
		const double A = static_cast<double>(I) / N;
		const double D = Evade::DistanceFraction(A);
		CHECK(D >= Prev - 1e-12);
		Prev = D;
		Numeric += Evade::SpeedFraction(A - 0.5 / N) / N;
	}
	NEAR(Numeric, Evade::RawDistance(1), 1e-6);
	NEAR(Evade::PeakSpeed() * Evade::Duration * Evade::RawDistance(1), 460, 1e-9);
	// Velocity is non-zero on the first tick.
	CHECK(Evade::SpeedFraction(0) > 0.3);
	CHECK(!Evade::IsInvulnerableAt(0.05));
	CHECK(Evade::IsInvulnerableAt(0.055));
	CHECK(Evade::IsInvulnerableAt(0.25));
	CHECK(!Evade::IsInvulnerableAt(0.255));
	double X, Y;
	Evade::ChooseDirection(0.2, 0.1, 0, 1, X, Y); // below threshold → facing
	NEAR(X, 0, 1e-12); NEAR(Y, 1, 1e-12);
	Evade::ChooseDirection(0.3, 0.0, 0, 1, X, Y);
	NEAR(X, 1, 1e-12); NEAR(Y, 0, 1e-12);
}

TEST(UnravelRadiusIsContinuous)
{
	NEAR(Unravel::RadiusAt(0), 100, 1e-9);
	NEAR(Unravel::RadiusAt(0.17), 315, 1e-9);
	NEAR(Unravel::RadiusAt(0.34), 530, 1e-9);
	NEAR(Unravel::RadiusAt(1.0), 530, 1e-9);
	double Prev = Unravel::RadiusAt(0);
	for (double T = 0; T <= 0.34; T += 0.001)
	{
		const double R = Unravel::RadiusAt(T);
		CHECK(R >= Prev && R - Prev < 2.0); // no jumps
		Prev = R;
	}
}

TEST(DamageModel)
{
	NEAR(Damage::ArmorMultiplier(0), 1.0, 1e-12);
	NEAR(Damage::ArmorMultiplier(20), 100.0 / 120.0, 1e-12);
	FRunRandom NoCrit(1);
	const auto R = Damage::Compute(32, 1.25, 1.0, 0.0, 1.5, 20, 0, NoCrit);
	CHECK(!R.bCrit);
	NEAR(R.Amount, 32 * 1.25 * 100.0 / 120.0, 1e-9);
	FRunRandom AlwaysCrit(1);
	const auto C = Damage::Compute(96, 1, 1, 1.0, 1.5, 0, 0.25, AlwaysCrit);
	CHECK(C.bCrit);
	NEAR(C.Amount, 96 * 1.5 * 1.25, 1e-9);
	// Base crit rate over a long deterministic sequence is ~5%.
	FRunRandom Rng = FRunRandom::Derive(99, Stream::Crit);
	int Crits = 0;
	for (int I = 0; I < 100000; ++I) Crits += Damage::Compute(10, 1, 1, Damage::BaseCritChance, 1.5, 0, 0, Rng).bCrit;
	CHECK(Crits > 4700 && Crits < 5300);
	double Barrier = 20;
	NEAR(Damage::AbsorbWithBarrier(15, Barrier), 0, 1e-12);
	NEAR(Barrier, 5, 1e-12);
	NEAR(Damage::AbsorbWithBarrier(15, Barrier), 10, 1e-12);
}

TEST(HitFeelProfiles)
{
	const FHitFeel N = HitFeelFor(EHitWeight::Normal, false, false);
	NEAR(N.GlobalHitstop, 0, 0); NEAR(N.EnemyFlash, 0.055, 1e-12); NEAR(N.CameraTranslation, 2.5, 1e-12);
	CHECK(HitFeelFor(EHitWeight::Normal, true, false).GlobalHitstop == 0); // crits on normal hits never stop the world
	const FHitFeel H = HitFeelFor(EHitWeight::Heavy, false, false);
	NEAR(H.EnemyAnimPause, 0.035, 1e-12); NEAR(H.GlobalHitstop, 0, 0);
	NEAR(HitFeelFor(EHitWeight::Heavy, true, false).GlobalHitstop, 0.028, 1e-12);
	NEAR(HitFeelFor(EHitWeight::Ultimate, false, true).GlobalHitstop, 0.042, 1e-12);
	NEAR(HitFeelFor(EHitWeight::Ultimate, true, false).GlobalHitstop, 0.028, 1e-12);
}

TEST(InputBufferPriorityLifetimeAndNewest)
{
	TInputBufferCore<8> B;
	B.Push(0, EInputPriority::Basic, 0.000);
	B.Push(6, EInputPriority::Evade, 0.010);
	B.Push(2, EInputPriority::Skill, 0.020);
	CHECK(B.Peek(0.05) == 6); // Evade beats skills
	B.Consume(6);
	CHECK(B.Peek(0.05) == 2);
	B.Consume(2);
	CHECK(B.Peek(0.119) == 0);
	CHECK(B.Peek(0.121) == -1); // expired after 120 ms
	// Newest instance per ability: re-press refreshes lifetime.
	B.Push(1, EInputPriority::Skill, 1.00);
	B.Push(1, EInputPriority::Skill, 1.10);
	CHECK(B.Peek(1.20) == 1);
	// Equal priority → newest press first.
	B.Push(3, EInputPriority::Skill, 1.15);
	CHECK(B.Peek(1.20) == 3);
	std::array<int32_t, 8> Order{};
	B.Push(5, EInputPriority::Defensive, 1.16);
	B.Push(0, EInputPriority::Basic, 1.17);
	const int32_t N = B.Ordered(1.20, Order);
	CHECK(N == 4);
	CHECK(Order[0] == 5 && Order[1] == 3 && Order[2] == 1 && Order[3] == 0);
}

TEST(AttackTokenCaps)
{
	FAttackTokenPools T;
	for (uint32_t E = 1; E <= 4; ++E) CHECK(T.TryAcquire(ETokenPool::Melee, E));
	CHECK(!T.TryAcquire(ETokenPool::Melee, 5));
	CHECK(T.TryAcquire(ETokenPool::Melee, 3)); // idempotent
	CHECK(T.InUse(ETokenPool::Melee) == 4);
	T.Release(ETokenPool::Melee, 2);
	CHECK(T.TryAcquire(ETokenPool::Melee, 5));
	CHECK(T.TryAcquire(ETokenPool::Heavy, 9));
	CHECK(!T.TryAcquire(ETokenPool::Heavy, 10));
	CHECK(T.WithinCaps());
	CHECK(FAttackTokenPools::PoolFor(EArchetype::Seer, false) == ETokenPool::Ranged);
	CHECK(FAttackTokenPools::PoolFor(EArchetype::Keeper, true) == ETokenPool::Heavy);
	CHECK(FAttackTokenPools::PoolFor(EArchetype::Hound, false) == ETokenPool::Melee);
}

TEST(EnemyTelegraphsMeetMinimums)
{
	for (int I = 0; I < NumArchetypes; ++I)
	{
		const FArchetypeStats S = DefaultStats(static_cast<EArchetype>(I));
		CHECK(S.Primary.Telegraph + 1e-9 >= TelegraphMinimum(S.Primary.Class));
		if (S.bHasHeavy) CHECK(S.Heavy.Telegraph + 1e-9 >= TelegraphMinimum(S.Heavy.Class));
	}
	for (int I = 0; I < NumBossAttacks; ++I)
	{
		const FBossAttackSpec B = BossAttack(static_cast<EBossAttack>(I));
		CHECK(B.Telegraph + 1e-9 >= TelegraphMinimum(B.Class));
	}
	CHECK(TelegraphMatches(280, 295, 1.05, 1.09));
	CHECK(!TelegraphMatches(280, 301, 1.05, 1.05));
	CHECK(!TelegraphMatches(280, 280, 1.05, 1.11));
}

TEST(BossPhasesStaggerAndExclusion)
{
	FBoundKingState K;
	K.MaxHealth = K.Health = 1000;
	auto O = K.ApplyHit(150, 0);
	CHECK(!O.bSpawnAdds && K.Phase == 1);
	O = K.ApplyHit(50, 0); // 80%
	CHECK(O.bSpawnAdds && !O.bPhaseChanged && K.Phase == 1);
	CHECK(!K.ApplyHit(1, 0).bSpawnAdds); // one time only
	O = K.ApplyHit(99, 0); // 70%
	CHECK(O.bPhaseChanged && K.Phase == 2 && K.IsInvulnerable());
	CHECK(K.ApplyHit(500, 0).Applied == 0); // safe during transition
	K.Tick(2.0);
	CHECK(!K.IsTransitioning());
	// Stagger: fills to 100, 4.5 s break, +25% damage taken, resets to 0.
	for (int I = 0; I < 4; ++I) K.ApplyHit(1, 24);
	O = K.ApplyHit(1, 24);
	CHECK(O.bStaggerBroke && K.IsStaggered() && K.Stagger == 0);
	NEAR(K.ApplyHit(10, 0).Applied, 12.5, 1e-9);
	CHECK(!K.CanAct());
	K.Tick(4.5);
	CHECK(!K.IsStaggered());
	// Decay starts after 6 s at 7/s.
	K.ApplyHit(1, 50);
	K.Tick(6.0);
	NEAR(K.Stagger, 50, 1e-9);
	K.Tick(2.0);
	NEAR(K.Stagger, 36, 1e-9);
	// Phase 3 and exclusion.
	K.ApplyHit(K.Health - 300, 0);
	CHECK(K.Phase == 3);
	K.Tick(2.0);
	K.BeginAttack(EBossAttack::BoundCircle);
	CHECK(!K.Allowed(EBossAttack::ManuscriptCollapse));
	K.EndAttack(EBossAttack::BoundCircle);
	K.BeginAttack(EBossAttack::ManuscriptCollapse);
	K.CooldownLeft[static_cast<int>(EBossAttack::BoundCircle)] = 0;
	CHECK(!K.Allowed(EBossAttack::BoundCircle));
	NEAR(K.CooldownLeft[static_cast<int>(EBossAttack::ManuscriptCollapse)], 12.0 * 0.85, 1e-9);
	// Tutorial never enters phase 3.
	FBoundKingState T;
	T.bTutorial = true;
	T.MaxHealth = T.Health = 1000;
	T.ApplyHit(310, 0); T.Tick(2);
	T.ApplyHit(500, 0);
	CHECK(T.Phase == 2);
}

TEST(LootRatesAndBias)
{
	FRunRandom R(3);
	CHECK(Loot::VeiledFormsFor(EDropSource::Room2, true, R) == 1);
	CHECK(Loot::VeiledFormsFor(EDropSource::Boss, false, R) == 2);
	CHECK(Loot::VeiledFormsFor(EDropSource::Elite, false, R) == 1);
	int Hits = 0;
	for (int I = 0; I < 20000; ++I) Hits += Loot::VeiledFormsFor(EDropSource::Room3, false, R);
	CHECK(Hits > 9600 && Hits < 10400);
	// Essence bundle cadence.
	FEssenceDropCounter C;
	int Drops = 0;
	for (int I = 0; I < 6500; ++I) Drops += C.OnNormalKill(R);
	CHECK(Drops >= 6500 / 8 && Drops <= 6500 / 5);
	// Bias: farming Hounds (Flex) selects higher-Flex Forms than farming Husks (Burden).
	std::vector<FCandidateView> Pool;
	FRunRandom P(11);
	for (int I = 0; I < 200; ++I)
	{
		FCandidateView V;
		V.Index = I;
		for (double& Q : V.Qualities) Q = P.Range(0, 100);
		V.TechnicalPercentile = P.Range(0, 100);
		Pool.push_back(V);
	}
	FFormBias Hounds, Husks;
	Hounds.AddKill(EArchetype::Hound, 10);
	Husks.AddKill(EArchetype::Husk, 10);
	double FlexH = 0, FlexK = 0;
	FRunRandom S(5);
	for (int I = 0; I < 300; ++I)
	{
		FlexH += Pool[ChooseCandidate(Pool, Hounds, 0, 0, false, S)].Qualities[static_cast<int>(EQuality::Flex)];
		FlexK += Pool[ChooseCandidate(Pool, Husks, 0, 0, false, S)].Qualities[static_cast<int>(EQuality::Flex)];
	}
	CHECK(FlexH / 300 > 75);
	CHECK(FlexH > FlexK + 300 * 20);
	FFormBias SeerBias;
	SeerBias.AddKill(EArchetype::Seer);
	NEAR(SeerBias.Weight[static_cast<int>(EQuality::Veil)], 0.5, 1e-12);
	NEAR(SeerBias.Weight[static_cast<int>(EQuality::Bond)], 0.5, 1e-12);
}

TEST(GearEvidenceFocus)
{
	NEAR(ArtifactPower(100, EEvidenceTier::Witnessed), 110, 1e-9);
	NEAR(ArtifactPower(120, EEvidenceTier::Witnessed), 110, 1e-9);
	NEAR(ArtifactPower(80, EEvidenceTier::Veiled), 56, 1e-9);
	NEAR(Gear::BladeDamageMultiplier(80), 1.4, 1e-12);
	NEAR(Gear::WardBonusHealth(80), 120, 1e-12);
	NEAR(Gear::SigilCooldownReduction(80), 0.16, 1e-12);
	NEAR(Gear::SigilCooldownReduction(200), 0.25, 1e-12);
	NEAR(Gear::CharmLootPercentileBonus(80), 8, 1e-12);
	CHECK(Focus::Cost(EFamiliarAction::DeepTrial) == 3 && Focus::PerRealm == 12);
}

TEST(DraughtRestore)
{
	FRunRandom R(1);
	CHECK(Draught::RestoresCharge(true, 3, R));
	CHECK(!Draught::RestoresCharge(true, 4, R));
	int N = 0;
	for (int I = 0; I < 100000; ++I) N += Draught::RestoresCharge(false, 0, R);
	CHECK(N > 6500 && N < 7500);
}

TEST(OffscreenFairness)
{
	CHECK(Fairness::InsideViewportWithMargin(-0.079, 0.5));
	CHECK(!Fairness::InsideViewportWithMargin(-0.081, 0.5));
	CHECK(!Fairness::MayBeginAttack(false, 1.2, 0.5, -1));
	CHECK(!Fairness::MayBeginAttack(false, 1.2, 0.5, 0.69));
	CHECK(Fairness::MayBeginAttack(false, 1.2, 0.5, 0.70));
	CHECK(Fairness::MayBeginAttack(true, 1.2, 0.5, -1));
}

TEST(SeededRooms) { RunSeededRoomsTest(); }

int main()
{
	for (auto& [Name, Fn] : Registry())
	{
		const int Before = Failures;
		Fn();
		std::printf("%s %s\n", Failures == Before ? "ok  " : "FAIL", Name.c_str());
	}
	std::printf("\n%d checks, %d failures\n", Checks, Failures);
	return Failures == 0 ? 0 : 1;
}

// Shared with test_rooms.cpp
void Check(bool bCond, const char* What)
{
	++Checks;
	if (!bCond)
	{
		++Failures;
		std::printf("  FAIL %s\n", What);
	}
}
