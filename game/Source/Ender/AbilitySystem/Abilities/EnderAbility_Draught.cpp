#include "AbilitySystem/Abilities/EnderAbility_Draught.h"

#include "AbilitySystem/EnderAbilityDefinition.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayEffects.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "AbilitySystemComponent.h"
#include "Character/EnderPlayerCharacter.h"

UEnderAbility_Draught::UEnderAbility_Draught()
{
	ActivationOwnedTags.AddTag(EnderTags::State_CastLocked);
}

bool UEnderAbility_Draught::CanActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo,
	const FGameplayTagContainer* SourceTags, const FGameplayTagContainer* TargetTags, FGameplayTagContainer* OptionalRelevantTags) const
{
	const AEnderPlayerCharacter* Binder = ActorInfo ? Cast<AEnderPlayerCharacter>(ActorInfo->AvatarActor.Get()) : nullptr;
	if (!Binder || Binder->GetDraughtCharges() <= 0) return false;
	const UAbilitySystemComponent* ASC = ActorInfo->AbilitySystemComponent.Get();
	if (ASC && ASC->GetNumericAttribute(UEnderAttributeSet::GetHealthAttribute()) >= ASC->GetNumericAttribute(UEnderAttributeSet::GetMaxHealthAttribute()))
		return false; // don't waste a charge at full health
	return Super::CanActivateAbility(Handle, ActorInfo, SourceTags, TargetTags, OptionalRelevantTags);
}

void UEnderAbility_Draught::OnActivated()
{
	AEnderPlayerCharacter* Binder = GetBinder();
	if (!Binder || !Binder->ConsumeDraughtCharge()) return;
	FGameplayEffectSpecHandle Spec = MakeOutgoingGameplayEffectSpec(UEnderGE_Heal::StaticClass(), 1.f);
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Magnitude, Definition->Heal);
	ApplyGameplayEffectSpecToOwner(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, Spec);
}
