#pragma once

#include "Abilities/GameplayAbility.h"
#include "Core/EnderTypes.h"
#include "EnderGameplayAbility.generated.h"

class UEnderAbilityDefinition;
class UEnderAbilitySystemComponent;
class UEnderTargetSweepComponent;
class AEnderPlayerCharacter;
struct FEnderDamageParams;

/**
 * Base for the Binder's ability archetypes. Timing is Windup → Active → Recovery
 * (§21) and comes from montage notify states: ANS_AttackWindow sends
 * Event.AttackWindow.Begin/End, ANS_CancelWindow and ANS_Invulnerability hold
 * loose tags, ANS_MovementOverride scales movement. Damage can only be dealt
 * between AttackWindow Begin and End.
 *
 * If a montage carries no ANS_AttackWindow (placeholder animations), the ability
 * runs the same events from its Definition on one timeline, so timing still has a
 * single source and the notify times the editor tool writes match it exactly.
 */
UCLASS(Abstract)
class ENDER_API UEnderGameplayAbility : public UGameplayAbility
{
	GENERATED_BODY()

public:
	UEnderGameplayAbility();

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ender")
	TObjectPtr<UEnderAbilityDefinition> Definition;

	virtual bool CheckCost(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, FGameplayTagContainer* OptionalRelevantTags) const override;
	virtual void ApplyCost(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo) const override;
	virtual const FGameplayTagContainer* GetCooldownTags() const override;
	virtual void ApplyCooldown(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo) const override;

	virtual void ActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo,
		const FGameplayAbilityActivationInfo ActivationInfo, const FGameplayEventData* TriggerEventData) override;
	virtual void EndAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo,
		const FGameplayAbilityActivationInfo ActivationInfo, bool bReplicateEndAbility, bool bWasCancelled) override;

protected:
	/** Archetype hooks. */
	virtual void OnActivated() {}
	virtual void OnAttackWindowBegin() {}
	virtual void OnAttackWindowTick(float /*SecondsIntoWindow*/, float /*DeltaTime*/) {}
	/** bCompleted is false when the ability was cut short inside its window. */
	virtual void OnAttackWindowEnd(bool /*bCompleted*/) {}
	virtual void OnEnded(bool /*bWasCancelled*/) {}
	/** Montage to play this activation (Thread Lash swaps in its combo montage). */
	virtual UAnimMontage* ChooseMontage() const;
	/** Seconds after which the ability ends when no montage drives it. */
	virtual float FallbackDuration() const;

	AEnderPlayerCharacter* GetBinder() const;
	UEnderAbilitySystemComponent* GetEnderASC() const;
	UEnderTargetSweepComponent* GetSweep() const;
	FVector GetAimDirection() const;
	FVector GetAimPoint() const;
	float GetElapsed() const { return Elapsed; }
	bool IsInAttackWindow() const { return bInWindow; }

	/** Damage through UEnderCombatStatics with this ability's tag and weight. Returns true if applied. */
	bool DealDamage(AActor* Target, const FHitResult& Hit, float BaseDamage, float Stagger, bool bFirstUltimateImpact = false);

	/** Sets the Binder's movement multiplier for the current phase (fallback path only; montages use ANS_MovementOverride). */
	void ApplyPhaseMovement();

	/** Loose tag held by this activation and released when it ends, whatever way it ends. */
	void SetOwnedLooseTag(const FGameplayTag& Tag, bool bOn);

	/** True when timing comes from the Definition because the montage has no notify states. */
	bool UsesFallbackTimeline() const { return bFallbackTimeline; }

private:
	UFUNCTION() void HandleWindowBegin(FGameplayEventData Payload);
	UFUNCTION() void HandleWindowEnd(FGameplayEventData Payload);
	UFUNCTION() void HandleTick(float DeltaTime);
	UFUNCTION() void HandleMontageDone();
	UFUNCTION() void HandleMontageCancelled();

	void BeginWindow();
	void EndWindow(bool bCompleted);
	static bool MontageHasAttackWindow(const UAnimMontage* Montage);

	float Elapsed = 0.f;
	float WindowElapsed = 0.f;
	bool bInWindow = false;
	bool bWindowDone = false;
	bool bFallbackTimeline = false;
	TSet<FGameplayTag> LooseTagsHeld;
	mutable FGameplayTagContainer CooldownTagsScratch;
};
