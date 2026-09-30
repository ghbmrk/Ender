#pragma once

#include "AbilitySystem/EnderGameplayAbility.h"
#include "EnderAbility_ExpandingRing.generated.h"

/**
 * Unravel (§26): the damage radius expands continuously from 100 to 530 cm over the
 * 0.34 s active window, queried every frame at exactly the radius the VFX shows
 * (EnderRules::Unravel::RadiusAt), each enemy hit once. Never an instantaneous query.
 * The cue receives the same start time so NS_Unravel's ring is driven by the same curve.
 */
UCLASS()
class ENDER_API UEnderAbility_ExpandingRing : public UEnderGameplayAbility
{
	GENERATED_BODY()

public:
	/** Radius at SecondsIntoWindow, from the Definition (start → end over Active). */
	UFUNCTION(BlueprintPure, Category = "Ender")
	float RadiusAt(float SecondsIntoWindow) const;

protected:
	virtual void OnAttackWindowBegin() override;
	virtual void OnAttackWindowTick(float SecondsIntoWindow, float DeltaTime) override;
	/** Final query at the full radius: the window can close between frames. */
	virtual void OnAttackWindowEnd(bool bCompleted) override;

private:
	FVector Center = FVector::ZeroVector;
};
