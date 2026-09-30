#pragma once

#include "AbilitySystem/EnderGameplayAbility.h"
#include "EnderAbility_SequencedStrikes.generated.h"

/**
 * Grand Fracture (§28): three strikes along the aim line at 250, 450 and 650 cm,
 * 0.11 s apart from the start of the active window, radius 180, 96 damage and 24
 * stagger each. Each strike has its own hit set, so one enemy can take all three.
 * Only the first successful impact of the cast gets the ultimate hit feel.
 */
UCLASS()
class ENDER_API UEnderAbility_SequencedStrikes : public UEnderGameplayAbility
{
	GENERATED_BODY()

protected:
	virtual void OnActivated() override;
	virtual void OnAttackWindowTick(float SecondsIntoWindow, float DeltaTime) override;
	virtual void OnAttackWindowEnd(bool bCompleted) override;

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender") void OnStrike(int32 Index, FVector Location, float Radius);

private:
	void Strike(int32 Index);

	FVector Origin = FVector::ZeroVector;
	FVector Direction = FVector::ForwardVector;
	int32 NextStrike = 0;
	bool bLandedFirst = false;
};
