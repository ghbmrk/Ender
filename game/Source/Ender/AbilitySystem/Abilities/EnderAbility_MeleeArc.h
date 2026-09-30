#pragma once

#include "AbilitySystem/EnderGameplayAbility.h"
#include "Rules/CombatRules.h"
#include "EnderAbility_MeleeArc.generated.h"

/**
 * Cone/arc strike archetype: Thread Lash (range 320, arc 100°, +14 Thread, third
 * Lash within 1.2 s → 44 dmg, 8 stagger, +18 Thread) and Sever (range 470, cone 68°,
 * 118 dmg, 16 stagger, 30 Thread, 65 cm motion-warped lunge). The cone is re-queried
 * every frame of the active window so a lunge carries the hit area with it; the
 * execution's hit set keeps each enemy to one hit.
 */
UCLASS()
class ENDER_API UEnderAbility_MeleeArc : public UEnderGameplayAbility
{
	GENERATED_BODY()

protected:
	virtual void OnActivated() override;
	virtual void OnAttackWindowBegin() override;
	virtual void OnAttackWindowTick(float SecondsIntoWindow, float DeltaTime) override;
	virtual UAnimMontage* ChooseMontage() const override;

	/** Motion-warp target name the Sever montage's root motion warps to. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender") FName WarpTargetName = TEXT("Lunge");

private:
	EnderRules::FLashCombo Combo;
	bool bEmpowered = false;
	bool bGainedThread = false;
	FVector StrikeDirection = FVector::ForwardVector;
};
