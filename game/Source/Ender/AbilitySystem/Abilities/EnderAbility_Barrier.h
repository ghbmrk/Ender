#pragma once

#include "AbilitySystem/EnderGameplayAbility.h"
#include "EnderAbility_Barrier.generated.h"

/**
 * Warding Sigil (§27): 0.17 s cast lock, Barrier = 35% of max health for 3.5 s.
 * While Effect.Barrier is present, normal-enemy attacks cannot hit-stun the Binder
 * (AEnderPlayerCharacter::HandleDamaged). The Binder clears leftover Barrier when the tag expires.
 */
UCLASS()
class ENDER_API UEnderAbility_Barrier : public UEnderGameplayAbility
{
	GENERATED_BODY()

public:
	UEnderAbility_Barrier();

protected:
	virtual void OnActivated() override;
};
