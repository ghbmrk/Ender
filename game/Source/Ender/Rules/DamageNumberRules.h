// Ender — floating damage numbers: lifetime, cap, same-frame aggregation.
//
// Engine-free. UEnderDamageNumberQueue (UI/) wraps this; the widget only draws
// what Live holds. Normal 18 px paper white, crit 23 px ochre, 0.65 s, at most
// 18 on screen; once at the cap, repeated hits on the same target in the same
// frame fold into one number instead of evicting others.
#pragma once

#include <cstdint>
#include <vector>

#include "CombatRules.h" // DamageNumbers::MaxSimultaneous, Lifetime, NormalSizePx, CritSizePx

namespace EnderRules
{
	namespace DamageNumbers
	{
		struct FEntry
		{
			uint32_t Id = 0;
			uint32_t TargetId = 0;
			double Amount = 0;
			bool bCrit = false;
			int32_t Hits = 1;
			uint64_t Frame = 0;
			double Age = 0;
			double X = 0, Y = 0, Z = 0;
		};

		struct FQueue
		{
			std::vector<FEntry> Live;
			uint32_t NextId = 1;

			/** Returns the id of the entry that now shows this hit (new or aggregated). */
			uint32_t Push(uint32_t TargetId, double Amount, bool bCrit, uint64_t Frame, double X, double Y, double Z)
			{
				if (static_cast<int32_t>(Live.size()) >= MaxSimultaneous)
				{
					// Fold into a same-frame number on the same target; a crit upgrades the number.
					for (FEntry& E : Live)
					{
						if (E.TargetId == TargetId && E.Frame == Frame)
						{
							E.Amount += Amount;
							E.bCrit = E.bCrit || bCrit;
							++E.Hits;
							return E.Id;
						}
					}
					// Otherwise the oldest number makes room.
					size_t Oldest = 0;
					for (size_t I = 1; I < Live.size(); ++I)
						if (Live[I].Age > Live[Oldest].Age) Oldest = I;
					Live.erase(Live.begin() + static_cast<std::ptrdiff_t>(Oldest));
				}
				FEntry E;
				E.Id = NextId++;
				E.TargetId = TargetId;
				E.Amount = Amount;
				E.bCrit = bCrit;
				E.Frame = Frame;
				E.X = X; E.Y = Y; E.Z = Z;
				Live.push_back(E);
				return E.Id;
			}

			void Tick(double Dt)
			{
				for (FEntry& E : Live) E.Age += Dt;
				size_t W = 0;
				for (size_t R = 0; R < Live.size(); ++R)
					if (Live[R].Age < Lifetime) Live[W++] = Live[R];
				Live.resize(W);
			}

			void Clear() { Live.clear(); }
		};
	}
}
