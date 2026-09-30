#include "AbilitySystem/EnderAbilitySystemGlobals.h"
#include "AbilitySystem/EnderGameplayEffectContext.h"

FGameplayEffectContext* UEnderAbilitySystemGlobals::AllocGameplayEffectContext() const
{
	return new FEnderGameplayEffectContext();
}
