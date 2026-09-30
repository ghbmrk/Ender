#pragma once

#include "AbilitySystemGlobals.h"
#include "EnderAbilitySystemGlobals.generated.h"

/** Allocates FEnderGameplayEffectContext. Selected in DefaultEngine.ini. */
UCLASS()
class ENDER_API UEnderAbilitySystemGlobals : public UAbilitySystemGlobals
{
	GENERATED_BODY()

public:
	virtual FGameplayEffectContext* AllocGameplayEffectContext() const override;
};
