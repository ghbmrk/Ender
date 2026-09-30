// Ender — playtest telemetry warnings (§ telemetry).
//
// Engine-free so the thresholds are unit-tested; UEnderTelemetrySubsystem feeds
// its recorded samples through Evaluate().
#pragma once

#include <algorithm>
#include <cstdint>
#include <vector>

namespace EnderRules
{
	namespace TelemetryRules
	{
		constexpr double SkillShareMin = 0.05;
		constexpr double SkillShareMax = 0.45;
		constexpr double RoomMedianMax = 55.0;
		constexpr double RoomMedianMin = 15.0;
		constexpr double BossFirstKillMedianMax = 150.0;

		enum class EWarning : uint8_t { SkillUnderused, SkillOverused, RoomsTooSlow, RoomsTooFast, OffscreenHits, BossTooSlow };

		struct FWarning
		{
			EWarning Kind = EWarning::SkillUnderused;
			int32_t Index = -1; // skill slot for skill warnings
			double Value = 0;
		};

		inline double Median(std::vector<double> V)
		{
			if (V.empty()) return 0;
			std::sort(V.begin(), V.end());
			const size_t N = V.size();
			return N % 2 ? V[N / 2] : 0.5 * (V[N / 2 - 1] + V[N / 2]);
		}

		/**
		 * SkillUses: activations per skill slot (six skills; Evade is not a skill here).
		 * RoomDurations and BossFirstKills in seconds.
		 */
		inline std::vector<FWarning> Evaluate(const std::vector<int32_t>& SkillUses, const std::vector<double>& RoomDurations,
			int32_t OffscreenHits, const std::vector<double>& BossFirstKills)
		{
			std::vector<FWarning> Out;
			int64_t Total = 0;
			for (int32_t U : SkillUses) Total += U;
			if (Total > 0)
			{
				for (size_t I = 0; I < SkillUses.size(); ++I)
				{
					const double Share = static_cast<double>(SkillUses[I]) / static_cast<double>(Total);
					if (Share < SkillShareMin) Out.push_back({EWarning::SkillUnderused, static_cast<int32_t>(I), Share});
					else if (Share > SkillShareMax) Out.push_back({EWarning::SkillOverused, static_cast<int32_t>(I), Share});
				}
			}
			if (!RoomDurations.empty())
			{
				const double M = Median(RoomDurations);
				if (M > RoomMedianMax) Out.push_back({EWarning::RoomsTooSlow, -1, M});
				else if (M < RoomMedianMin) Out.push_back({EWarning::RoomsTooFast, -1, M});
			}
			if (OffscreenHits > 0) Out.push_back({EWarning::OffscreenHits, -1, static_cast<double>(OffscreenHits)});
			if (!BossFirstKills.empty())
			{
				const double M = Median(BossFirstKills);
				if (M > BossFirstKillMedianMax) Out.push_back({EWarning::BossTooSlow, -1, M});
			}
			return Out;
		}
	}
}
