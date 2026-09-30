// Ender — combat input buffer core.
//
// Raw input never executes an ability. Presses enter this buffer; each tick the
// highest-priority live request is offered to the ability system, which either
// activates it (request consumed) or refuses (request stays until it expires).
// One pending request per ability: a newer press replaces the older one.
#pragma once

#include <array>
#include <cstdint>

namespace EnderRules
{
	/** Higher value wins. Order is the spec's: Death > Hit Reaction > Evade > Defensive > Other > Basic > Movement. */
	enum class EInputPriority : uint8_t
	{
		Movement = 0,
		Basic = 1,
		Skill = 2,
		Defensive = 3,
		Evade = 4,
		HitReaction = 5,
		Death = 6,
	};

	constexpr double InputBufferLifetime = 0.120;

	template <int32_t NumSlots>
	struct TInputBufferCore
	{
		struct FEntry
		{
			bool bLive = false;
			double PressedAt = 0;
			uint64_t Sequence = 0;
			EInputPriority Priority = EInputPriority::Basic;
		};

		std::array<FEntry, NumSlots> Entries{};
		uint64_t NextSequence = 1;
		double Lifetime = InputBufferLifetime;

		/** Record a press. Keeps only the newest instance for the slot. */
		void Push(int32_t Slot, EInputPriority Priority, double Now)
		{
			if (Slot < 0 || Slot >= NumSlots) return;
			FEntry& E = Entries[Slot];
			E.bLive = true;
			E.PressedAt = Now;
			E.Priority = Priority;
			E.Sequence = NextSequence++;
		}

		void Expire(double Now)
		{
			for (FEntry& E : Entries)
				if (E.bLive && Now - E.PressedAt > Lifetime) E.bLive = false;
		}

		/**
		 * Highest-priority live slot; ties go to the newest press. -1 if none.
		 * The caller tries to activate it and calls Consume on success.
		 */
		int32_t Peek(double Now)
		{
			Expire(Now);
			int32_t Best = -1;
			for (int32_t I = 0; I < NumSlots; ++I)
			{
				const FEntry& E = Entries[I];
				if (!E.bLive) continue;
				if (Best < 0 || E.Priority > Entries[Best].Priority ||
					(E.Priority == Entries[Best].Priority && E.Sequence > Entries[Best].Sequence))
					Best = I;
			}
			return Best;
		}

		/** Live slots in the order they should be tried this tick (priority desc, then newest). */
		int32_t Ordered(double Now, std::array<int32_t, NumSlots>& Out)
		{
			Expire(Now);
			int32_t N = 0;
			for (int32_t I = 0; I < NumSlots; ++I)
				if (Entries[I].bLive) Out[N++] = I;
			for (int32_t I = 1; I < N; ++I)
			{
				const int32_t Key = Out[I];
				int32_t J = I - 1;
				while (J >= 0 && Before(Key, Out[J]))
				{
					Out[J + 1] = Out[J];
					--J;
				}
				Out[J + 1] = Key;
			}
			return N;
		}

		void Consume(int32_t Slot)
		{
			if (Slot >= 0 && Slot < NumSlots) Entries[Slot].bLive = false;
		}

		void Clear()
		{
			for (FEntry& E : Entries) E.bLive = false;
		}

		bool IsLive(int32_t Slot) const { return Slot >= 0 && Slot < NumSlots && Entries[Slot].bLive; }

	private:
		bool Before(int32_t A, int32_t B) const
		{
			const FEntry& EA = Entries[A];
			const FEntry& EB = Entries[B];
			return EA.Priority > EB.Priority || (EA.Priority == EB.Priority && EA.Sequence > EB.Sequence);
		}
	};
}
