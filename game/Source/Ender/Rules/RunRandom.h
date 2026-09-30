// Ender — deterministic run RNG.
//
// Engine-free: this header compiles inside the Unreal module and in the
// standalone rule tests (tests/cpp). Every random decision that affects
// gameplay (crits, loot, encounter composition, spawn choice) draws from a
// stream derived from the run seed, so a seed replays identically.
#pragma once

#include <cstdint>

namespace EnderRules
{
	/** SplitMix64: tiny, fast, statistically fine for gameplay, identical on every platform. */
	struct FRunRandom
	{
		uint64_t State = 0;

		FRunRandom() = default;
		explicit FRunRandom(uint64_t Seed) : State(Seed) {}

		/** Independent stream for a subsystem (e.g. Stream::Crit) so adding draws in one system never shifts another. */
		static FRunRandom Derive(uint64_t RunSeed, uint64_t StreamId)
		{
			FRunRandom Mixer(RunSeed ^ (0x9E3779B97F4A7C15ull * (StreamId + 1)));
			return FRunRandom(Mixer.NextU64());
		}

		uint64_t NextU64()
		{
			uint64_t Z = (State += 0x9E3779B97F4A7C15ull);
			Z = (Z ^ (Z >> 30)) * 0xBF58476D1CE4E5B9ull;
			Z = (Z ^ (Z >> 27)) * 0x94D049BB133111EBull;
			return Z ^ (Z >> 31);
		}

		/** Uniform in [0, 1). 53 bits of precision. */
		double NextUnit() { return static_cast<double>(NextU64() >> 11) * (1.0 / 9007199254740992.0); }

		/** Uniform integer in [Lo, Hi] inclusive. */
		int32_t RangeInt(int32_t Lo, int32_t Hi)
		{
			if (Hi <= Lo) return Lo;
			const uint64_t Span = static_cast<uint64_t>(static_cast<int64_t>(Hi) - Lo + 1);
			return static_cast<int32_t>(Lo + static_cast<int64_t>(NextU64() % Span));
		}

		double Range(double Lo, double Hi) { return Lo + (Hi - Lo) * NextUnit(); }

		bool Chance(double P) { return NextUnit() < P; }
	};

	/** Stream ids. Append only: reordering changes every replay. */
	namespace Stream
	{
		constexpr uint64_t Crit = 1;
		constexpr uint64_t Loot = 2;
		constexpr uint64_t Encounter = 3;
		constexpr uint64_t Spawn = 4;
		constexpr uint64_t BossPattern = 5;
		constexpr uint64_t Draught = 6;
		constexpr uint64_t Audio = 7;
		constexpr uint64_t AI = 8;
	}
}
