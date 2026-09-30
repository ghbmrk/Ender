#include "AbilitySystem/EnderAbilitySystemComponent.h"

#include "AbilitySystem/EnderGameplayTags.h"
#include "AbilitySystem/EnderAbilityDefinition.h"
#include "AbilitySystem/EnderGameplayAbility.h"

UEnderAbilitySystemComponent::UEnderAbilitySystemComponent()
{
	SetIsReplicatedByDefault(false); // single-player MVP
}

/** An ability answers to its asset tags and, for Ender abilities, its Definition's AbilityTag. */
static bool AbilityMatches(const UGameplayAbility* Ability, const FGameplayTag& AbilityTag)
{
	if (!Ability) return false;
	if (Ability->GetAssetTags().HasTagExact(AbilityTag)) return true;
	const UEnderGameplayAbility* Ender = Cast<UEnderGameplayAbility>(Ability);
	return Ender && Ender->Definition && Ender->Definition->AbilityTag == AbilityTag;
}

FGameplayAbilitySpec* UEnderAbilitySystemComponent::FindSpecByTag(const FGameplayTag& AbilityTag)
{
	for (FGameplayAbilitySpec& Spec : GetActivatableAbilities())
	{
		if (AbilityMatches(Spec.Ability, AbilityTag)) return &Spec;
	}
	return nullptr;
}

bool UEnderAbilitySystemComponent::IsAbilityActive(const FGameplayTag& AbilityTag) const
{
	for (const FGameplayAbilitySpec& Spec : GetActivatableAbilities())
	{
		if (Spec.IsActive() && AbilityMatches(Spec.Ability, AbilityTag)) return true;
	}
	return false;
}

bool UEnderAbilitySystemComponent::CancelActiveForNewRequest(const FGameplayAbilitySpec& Incoming, EEnderInputPriority Priority)
{
	if (!HasMatchingGameplayTag(EnderTags::State_Attacking)) return true; // nothing to interrupt

	const bool bEvade = Priority == EEnderInputPriority::Evade;
	const bool bForced = Priority >= EEnderInputPriority::HitReaction;
	const bool bWindowOpen = bForced ||
		(bEvade && HasMatchingGameplayTag(EnderTags::Window_Cancel_Evade)) ||
		(!bEvade && HasMatchingGameplayTag(EnderTags::Window_Cancel_Skill));
	if (!bWindowOpen) return false;

	for (FGameplayAbilitySpec& Spec : GetActivatableAbilities())
	{
		if (!Spec.IsActive() || Spec.Handle == Incoming.Handle || !Spec.Ability) continue;
		CancelAbilityHandle(Spec.Handle);
	}
	return true;
}

bool UEnderAbilitySystemComponent::TryActivateFromBuffer(const FGameplayTag& AbilityTag, EEnderInputPriority Priority)
{
	if (HasMatchingGameplayTag(EnderTags::State_Dead)) return false;
	FGameplayAbilitySpec* Spec = FindSpecByTag(AbilityTag);
	if (!Spec || !Spec->Ability) return false;

	// Cheap checks first so a press during a cooldown stays buffered without cancelling anything.
	const FGameplayAbilityActorInfo* Info = AbilityActorInfo.Get();
	if (!Spec->Ability->CheckCooldown(Spec->Handle, Info) || !Spec->Ability->CheckCost(Spec->Handle, Info)) return false;
	if (Spec->IsActive()) return false; // same ability re-press waits for the chain/cancel window
	if (!CancelActiveForNewRequest(*Spec, Priority)) return false;
	return TryActivateAbility(Spec->Handle);
}

float UEnderAbilitySystemComponent::GetCooldownRemaining(const FGameplayTag& CooldownTag) const
{
	const FGameplayEffectQuery Query = FGameplayEffectQuery::MakeQuery_MatchAnyOwningTags(FGameplayTagContainer(CooldownTag));
	float Longest = 0.f;
	for (const float Left : GetActiveEffectsTimeRemaining(Query)) Longest = FMath::Max(Longest, Left);
	return Longest;
}

void UEnderAbilitySystemComponent::SetWindowTag(const FGameplayTag& Tag, bool bOpen)
{
	if (bOpen) AddLooseGameplayTag(Tag);
	else RemoveLooseGameplayTag(Tag);
}

void UEnderAbilitySystemComponent::NotifyDamaged(const FEnderDamageEvent& Event)
{
	OnDamagedNative.Broadcast(this, Event);
	OnDamaged.Broadcast(Event);
	if (Event.Instigator)
	{
		if (UEnderAbilitySystemComponent* Source = Event.Instigator->FindComponentByClass<UEnderAbilitySystemComponent>())
		{
			if (Source != this) Source->OnDealtDamageNative.Broadcast(this, Event);
		}
	}
	if (Event.bKilled && !HasMatchingGameplayTag(EnderTags::State_Dead))
	{
		AddLooseGameplayTag(EnderTags::State_Dead);
		CancelAllAbilities();
		FGameplayEventData Payload;
		Payload.EventTag = EnderTags::Event_Death;
		Payload.Instigator = Event.Instigator;
		HandleGameplayEvent(EnderTags::Event_Death, &Payload);
		OnDied.Broadcast(Event.Instigator);
	}
}
