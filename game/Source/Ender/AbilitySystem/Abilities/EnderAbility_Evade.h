#pragma once

#include "AbilitySystem/EnderGameplayAbility.h"
#include "EnderAbility_Evade.generated.h"

class UCurveFloat;

/**
 * Evade (§29): 460 cm in 0.34 s, cooldown 1.65 s, invulnerable 0.055–0.255 s.
 * Direction is the movement input when its magnitude is ≥0.25, otherwise facing.
 * Motion is a root-motion force whose strength follows the spec's curve (accelerate
 * 0–20%, peak 20–65%, decelerate 65–100%; EnderRules::Evade), applied from the
 * next movement tick. Invulnerability comes from ANS_Invulnerability when the
 * montage has it, else from the same rule on the fallback timeline.
 */
UCLASS()
class ENDER_API UEnderAbility_Evade : public UEnderGameplayAbility
{
	GENERATED_BODY()

public:
	UEnderAbility_Evade();

protected:
	virtual void OnActivated() override;
	virtual void OnAttackWindowTick(float SecondsIntoWindow, float DeltaTime) override;

private:
	UPROPERTY() TObjectPtr<UCurveFloat> SpeedCurve;
	bool bMontageInvuln = false;
};
