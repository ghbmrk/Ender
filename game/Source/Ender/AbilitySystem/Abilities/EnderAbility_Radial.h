#pragma once

#include "AbilitySystem/EnderGameplayAbility.h"
#include "EnderAbility_Radial.generated.h"

/**
 * Radial control archetype — Bind (§25): radius 550, 22 damage to all.
 * Normal: pulled 260 cm toward the Binder and rooted 1.2 s.
 * Elite: pulled 80 cm, slowed 35% for 1.2 s, 20 stagger.
 * Boss: never displaced, 22 stagger.
 */
UCLASS()
class ENDER_API UEnderAbility_Radial : public UEnderGameplayAbility
{
	GENERATED_BODY()

protected:
	virtual void OnAttackWindowTick(float SecondsIntoWindow, float DeltaTime) override;

	/** Stop pulled enemies this far from the Binder so they don't overlap the capsule. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender") float PullStandoff = 110.f;
	UPROPERTY(EditDefaultsOnly, Category = "Ender") float PullDuration = 0.15f;

private:
	void Pull(AActor* Target, float Distance) const;
};
