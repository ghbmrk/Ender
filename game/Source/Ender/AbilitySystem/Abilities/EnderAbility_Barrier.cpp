#include "AbilitySystem/Abilities/EnderAbility_Barrier.h"

#include "AbilitySystem/EnderAbilityDefinition.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayEffects.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "AbilitySystemComponent.h"
#include "Combat/EnderCombatStatics.h"

UEnderAbility_Barrier::UEnderAbility_Barrier()
{
	ActivationOwnedTags.AddTag(EnderTags::State_CastLocked);
}

void UEnderAbility_Barrier::OnActivated()
{
	UAbilitySystemComponent* ASC = GetAbilitySystemComponentFromActorInfo();
	AActor* Avatar = GetAvatarActorFromActorInfo();
	if (!ASC || !Avatar) return;
	const float Amount = Definition->BarrierFractionOfMaxHealth * ASC->GetNumericAttribute(UEnderAttributeSet::GetMaxHealthAttribute());
	FGameplayEffectSpecHandle Spec = MakeOutgoingGameplayEffectSpec(UEnderGE_SetBarrier::StaticClass(), 1.f);
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Magnitude, Amount);
	ApplyGameplayEffectSpecToOwner(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, Spec);
	UEnderCombatStatics::ApplyStatusTag(Avatar, Avatar, EnderTags::Effect_Barrier, Definition->EffectDuration);
}
