// Spec §94: run 100 seeded rooms and assert
//   attack token caps never violated · no prohibited spawns ·
//   no off-screen normal attacks · enemy count caps respected.
// The simulation itself is Rules/RoomSimulation.h, shared with the in-engine test.
#include <cstdio>

#include "Rules/RoomSimulation.h"

using namespace EnderRules;

void Check(bool bCond, const char* What);

void RunSeededRoomsTest()
{
	const FRoomSimTotals T = SimulateSeededRooms(100);
	std::printf("  rooms %d · spawns %d · attacks %d · prohibited spawns %d · token violations %d · "
		"offscreen starts %d · offscreen hits %d · cap violations %d · invalid plans %d · unfinished %d\n",
		T.Rooms, T.Spawns, T.Attacks, T.ProhibitedSpawns, T.TokenViolations, T.OffscreenStarts, T.OffscreenHits,
		T.CapViolations, T.PlanInvalid, T.Unfinished);
	Check(T.Rooms == 100, "100 rooms simulated");
	Check(T.PlanInvalid == 0, "every plan satisfies budgets, caps and roles");
	Check(T.ProhibitedSpawns == 0, "no prohibited spawns");
	Check(T.TokenViolations == 0, "attack token caps never violated");
	Check(T.OffscreenStarts == 0, "no off-screen normal attack starts");
	Check(T.OffscreenHits == 0, "no off-screen normal attack hits");
	Check(T.CapViolations == 0, "enemy count caps respected");
	Check(T.Attacks > 1000, "enemies actually attacked");
	Check(T.Unfinished == 0, "every room was cleared");
}
