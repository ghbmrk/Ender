#pragma once

#include "AbilitySystem/EnderGameplayAbility.h"
#include "EnderAbility_Draught.generated.h"

/** §33 Draught: 4 charges, heal 35, 0.25 s lock, 1.0 s cooldown. Charges live on the Binder. */
UCLASS()
class ENDER_API UEnderAbility_Draught : public UEnderGameplayAbility
{
	GENERATED_BODY()

public:
	UEnderAbility_Draught();

	virtual bool CanActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo,
		const FGameplayTagContainer* SourceTags, const FGameplayTagContainer* TargetTags, FGameplayTagContainer* OptionalRelevantTags) const override;

protected:
	virtual void OnActivated() override;
};
