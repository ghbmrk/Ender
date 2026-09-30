// Ender — seeded room simulation (spec §94).
//
// Runs N seeded rooms through the same rules the Unreal systems call (composition,
// waves, spawn legality, attack tokens, off-screen fairness) in a 2D simulation at
// 30 Hz and counts every violation. Shared by tests/cpp (standalone) and the
// in-engine automation test Ender.Rules.SeededRooms.
#pragma once

#include <cmath>
#include <cstdint>
#include <vector>

#include "CameraRules.h"
#include "EncounterRules.h"
#include "EnemyRules.h"

namespace EnderRules
{
	struct FRoomSimTotals
	{
		int Rooms = 0, Spawns = 0, ProhibitedSpawns = 0, TokenViolations = 0, OffscreenStarts = 0, OffscreenHits = 0;
		int CapViolations = 0, Attacks = 0, PlanInvalid = 0, Unfinished = 0;
	};

	namespace RoomSimDetail
	{
		enum class EState { Spawning, Approach, Orbit, Telegraph, Execute, Recover, Dead };

		struct FSimEnemy
		{
			uint32_t Id = 0;
			FPlannedEnemy Plan;
			FArchetypeStats Stats;
			double X = 0, Y = 0, Hp = 0;
			EState State = EState::Spawning;
			double StateTime = 0;
			double OrbitTime = 0;
			bool bHasLeapt = false;
			double Cooldown = 0;
			bool bHeavy = false;
			ETokenPool Pool = ETokenPool::Melee;
		};

		inline double Dist(double AX, double AY, double BX, double BY) { return std::hypot(AX - BX, AY - BY); }
	}

	inline FRoomSimTotals SimulateSeededRooms(uint64_t Count = 100)
	{
		FRoomSimTotals T;
		constexpr double Dt = 1.0 / 30.0;
		constexpr double HalfW = 1200, HalfD = 1000;
		const ERoomKind Kinds[] = {ERoomKind::Room1, ERoomKind::Room2, ERoomKind::Room3, ERoomKind::Room4, ERoomKind::Elite};

		for (uint64_t Seed = 1; Seed <= Count; ++Seed)
		{
			const ERoomKind Kind = Kinds[(Seed - 1) % 5];
			const FRoomRules Rules = RulesFor(Kind, Seed % 2 == 0);
			FRunRandom Enc = FRunRandom::Derive(Seed, Stream::Encounter);
			FRunRandom Spawn = FRunRandom::Derive(Seed, Stream::Spawn);
			FRunRandom Ai = FRunRandom::Derive(Seed, Stream::AI);
			const FEncounterPlan Plan = PlanEncounter(Rules, Enc);
			++T.Rooms;
			if (!PlanIsValid(Plan, Rules)) ++T.PlanInvalid;

			FAttackTokenPools Tokens;
			std::vector<RoomSimDetail::FSimEnemy> Enemies;
			double PX = 0, PY = -600, FX = 0, FY = 1, PDirT = 0;
			int OpeningPop = 0;
			bool bReinforced = false;
			double Elapsed = 0;
			uint32_t NextId = 1;

			auto Queue = [&](int Wave) {
				for (const FPlannedEnemy& P : Plan.Enemies)
				{
					if (P.Wave != Wave) continue;
					RoomSimDetail::FSimEnemy E;
					E.Id = NextId++;
					E.Plan = P;
					E.Stats = ApplyElite(DefaultStats(P.Archetype), P.Elite);
					E.Hp = E.Stats.Health;
					E.StateTime = -Waves::SpawnDelay; // telegraphed arrival
					// Candidate point chosen at queue time; re-validated when it materialises.
					E.X = Spawn.Range(-HalfW + 100, HalfW - 100);
					E.Y = Spawn.Range(-HalfD + 100, HalfD - 100);
					Enemies.push_back(E);
					if (Wave == 0) ++OpeningPop;
				}
			};
			Queue(0);

			for (int Step = 0; Step < 30 * 180; ++Step)
			{
				Elapsed += Dt;
				// Player wanders; re-picks a heading every ~0.8 s; stays inside the room.
				PDirT -= Dt;
				if (PDirT <= 0)
				{
					const double A = Ai.Range(0, 6.2831853);
					FX = std::cos(A); FY = std::sin(A); PDirT = 0.8;
				}
				PX = Clamp(PX + FX * Binder::MaxSpeed * 0.6 * Dt, -HalfW + 60, HalfW - 60);
				PY = Clamp(PY + FY * Binder::MaxSpeed * 0.6 * Dt, -HalfD + 60, HalfD - 60);

				int Alive = 0, AliveOpening = 0, AliveNormal = 0;
				for (RoomSimDetail::FSimEnemy& E : Enemies)
				{
					if (E.State == RoomSimDetail::EState::Dead) continue;
					E.StateTime += Dt;
					if (E.State == RoomSimDetail::EState::Spawning)
					{
						if (E.StateTime < 0) continue;
						// Materialise: the director re-rolls until the point is legal right now.
						int Tries = 0;
						while (!SpawnPointAllowed(PX, PY, FX, FY, E.X, E.Y) && Tries++ < 64)
						{
							E.X = Spawn.Range(-HalfW + 100, HalfW - 100);
							E.Y = Spawn.Range(-HalfD + 100, HalfD - 100);
						}
						if (!SpawnPointAllowed(PX, PY, FX, FY, E.X, E.Y))
						{
							E.StateTime = -0.2; // wait and retry; never place illegally
							continue;
						}
						++T.Spawns;
						if (!SpawnPointAllowed(PX, PY, FX, FY, E.X, E.Y)) ++T.ProhibitedSpawns;
						E.State = RoomSimDetail::EState::Approach;
						E.StateTime = 0;
					}
					++Alive;
					if (E.Plan.Wave == 0) ++AliveOpening;
					if (E.Plan.Elite == EEliteModifier::None) ++AliveNormal;

					double U, V;
					CameraRules::ProjectToScreen(PX, PY, E.X, E.Y, U, V);
					const bool bOnScreen = Fairness::InsideViewportWithMargin(U, V);
					const double D = RoomSimDetail::Dist(E.X, E.Y, PX, PY);
					E.Cooldown -= Dt;

					auto MoveToward = [&](double TX, double TY, double Speed) {
						const double L = RoomSimDetail::Dist(E.X, E.Y, TX, TY);
						if (L < 1) return;
						E.X += (TX - E.X) / L * Speed * Dt;
						E.Y += (TY - E.Y) / L * Speed * Dt;
					};

					switch (E.State)
					{
					case RoomSimDetail::EState::Approach:
					case RoomSimDetail::EState::Orbit:
					{
						const bool bRanged = E.Stats.PreferredRangeMax > 0;
						const double Want = bRanged ? E.Stats.PreferredRangeMin : E.Stats.Primary.Range * 0.8;
						if (D > Want + 50) MoveToward(PX, PY, E.Stats.MoveSpeed);
						else if (bRanged && D < Want - 100) MoveToward(2 * E.X - PX, 2 * E.Y - PY, E.Stats.MoveSpeed);
						else
						{
							// Orbit / threaten.
							E.State = RoomSimDetail::EState::Orbit;
							E.OrbitTime += Dt;
							const double OX = -(PY - E.Y) / std::max(D, 1.0), OY = (PX - E.X) / std::max(D, 1.0);
							E.X += OX * E.Stats.MoveSpeed * 0.4 * Dt;
							E.Y += OY * E.Stats.MoveSpeed * 0.4 * Dt;
						}
						const bool bInRange = D <= E.Stats.Primary.Range + (bRanged ? 100 : 0);
						const bool bHoundReady = E.Plan.Archetype != EArchetype::Hound || E.bHasLeapt || E.OrbitTime >= Hound::MinOrbitBeforeFirstLeap;
						if (bInRange && E.Cooldown <= 0 && bHoundReady)
						{
							E.bHeavy = E.Stats.bHasHeavy && Ai.Chance(0.3);
							E.Pool = E.bHeavy ? E.Stats.Heavy.Pool : E.Stats.Primary.Pool;
							// Order matters and mirrors the StateTree: fairness gate, then token, then windup.
							if (!Fairness::MayBeginAttack(false, U, V, -1.0)) break;
							if (!Tokens.TryAcquire(E.Pool, E.Id)) break;
							if (!bOnScreen) ++T.OffscreenStarts;
							E.State = RoomSimDetail::EState::Telegraph;
							E.StateTime = 0;
							++T.Attacks;
						}
						break;
					}
					case RoomSimDetail::EState::Telegraph:
					{
						const FEnemyAttack& A = E.bHeavy ? E.Stats.Heavy : E.Stats.Primary;
						if (E.StateTime >= A.Telegraph)
						{
							E.State = RoomSimDetail::EState::Execute;
							E.StateTime = 0;
							// Release-at-execute guard: an attacker that left the screen during its windup aborts.
							if (!bOnScreen)
							{
								Tokens.Release(E.Pool, E.Id);
								E.State = RoomSimDetail::EState::Recover;
								break;
							}
							if (!bOnScreen) ++T.OffscreenHits;
							if (E.Plan.Archetype == EArchetype::Hound) E.bHasLeapt = true;
						}
						break;
					}
					case RoomSimDetail::EState::Execute:
						if (E.StateTime >= 0.1)
						{
							E.State = RoomSimDetail::EState::Recover;
							E.StateTime = 0;
						}
						break;
					case RoomSimDetail::EState::Recover:
					{
						const FEnemyAttack& A = E.bHeavy ? E.Stats.Heavy : E.Stats.Primary;
						if (E.StateTime >= A.Recovery)
						{
							Tokens.Release(E.Pool, E.Id);
							E.Cooldown = A.Cooldown;
							E.State = RoomSimDetail::EState::Approach;
							E.StateTime = 0;
						}
						break;
					}
					default:
						break;
					}
					E.X = Clamp(E.X, -HalfW, HalfW);
					E.Y = Clamp(E.Y, -HalfD, HalfD);
				}

				// Player damage: ~95 DPS on the nearest enemy within 500 cm.
				RoomSimDetail::FSimEnemy* Target = nullptr;
				double Best = 500;
				for (RoomSimDetail::FSimEnemy& E : Enemies)
					if (E.State != RoomSimDetail::EState::Dead && E.State != RoomSimDetail::EState::Spawning && RoomSimDetail::Dist(E.X, E.Y, PX, PY) < Best)
					{
						Best = RoomSimDetail::Dist(E.X, E.Y, PX, PY);
						Target = &E;
					}
				if (Target)
				{
					Target->Hp -= 95 * Dt * Damage::ArmorMultiplier(Target->Stats.Armor);
					if (Target->Hp <= 0)
					{
						Target->State = RoomSimDetail::EState::Dead;
						Tokens.ReleaseAll(Target->Id);
					}
				}

				if (!Tokens.WithinCaps()) ++T.TokenViolations;
				int Attacking[NumTokenPools] = {};
				for (const RoomSimDetail::FSimEnemy& E : Enemies)
					if (E.State == RoomSimDetail::EState::Telegraph || E.State == RoomSimDetail::EState::Execute || E.State == RoomSimDetail::EState::Recover)
						if (Tokens.Holds(E.Pool, E.Id)) ++Attacking[static_cast<int>(E.Pool)];
				for (int P = 0; P < NumTokenPools; ++P)
					if (Attacking[P] > Tokens.Capacity[P]) ++T.TokenViolations;
				if (AliveNormal > Caps::MaxNormal) ++T.CapViolations;

				if (!bReinforced && ShouldReinforce(OpeningPop, AliveOpening, Elapsed))
				{
					bReinforced = true;
					Queue(1);
				}
				if (bReinforced && Alive == 0)
				{
					bool bPending = false;
					for (const RoomSimDetail::FSimEnemy& E : Enemies) bPending |= E.State == RoomSimDetail::EState::Spawning;
					if (!bPending) break;
				}
				if (Step == 30 * 180 - 1) ++T.Unfinished;
			}
		}
		return T;
	}
}
