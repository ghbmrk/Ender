#include "Combat/EnderCombatInputBuffer.h"

#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Engine/World.h"

UEnderCombatInputBuffer::UEnderCombatInputBuffer()
{
	PrimaryComponentTick.bCanEverTick = true;
	// Before the character's movement tick so an Evade's root motion starts on the next movement update.
	PrimaryComponentTick.TickGroup = TG_PrePhysics;

	Slots = {
		{EnderTags::Ability_Basic_ThreadLash, EEnderInputPriority::Basic},
		{EnderTags::Ability_Core_Sever, EEnderInputPriority::Skill},
		{EnderTags::Ability_Control_Bind, EEnderInputPriority::Skill},
		{EnderTags::Ability_Area_Unravel, EEnderInputPriority::Skill},
		{EnderTags::Ability_Defense_WardingSigil, EEnderInputPriority::Defensive},
		{EnderTags::Ability_Ultimate_GrandFracture, EEnderInputPriority::Skill},
		{EnderTags::Ability_Movement_Evade, EEnderInputPriority::Evade},
		{EnderTags::Ability_Draught, EEnderInputPriority::Defensive},
	};
}

void UEnderCombatInputBuffer::Press(int32 Slot)
{
	if (!Slots.IsValidIndex(Slot) || Slot >= MaxSlots) return;
	Core.Lifetime = Lifetime;
	Core.Push(Slot, EnderConvert::ToRules(Slots[Slot].Priority), GetWorld()->GetTimeSeconds());
	// Try immediately so an available ability starts this frame rather than next tick.
	TickComponent(0.f, LEVELTICK_All, nullptr);
}

void UEnderCombatInputBuffer::ClearAll()
{
	Core.Clear();
}

void UEnderCombatInputBuffer::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	if (ThisTickFunction) Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	UEnderAbilitySystemComponent* ASC = GetOwner()->FindComponentByClass<UEnderAbilitySystemComponent>();
	if (!ASC) return;
	if (ASC->HasMatchingGameplayTag(EnderTags::State_Dead))
	{
		Core.Clear();
		return;
	}

	std::array<int32, MaxSlots> Order{};
	const int32 N = Core.Ordered(GetWorld()->GetTimeSeconds(), Order);
	for (int32 I = 0; I < N; ++I)
	{
		const int32 Slot = Order[I];
		if (ASC->TryActivateFromBuffer(Slots[Slot].AbilityTag, Slots[Slot].Priority))
		{
			Core.Consume(Slot);
			LastActivatedSlot = Slot;
			break;
		}
	}
}
