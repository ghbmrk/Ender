#pragma once

#include "AbilitySystemComponent.h"
#include "Core/EnderTypes.h"
#include "EnderAbilitySystemComponent.generated.h"

USTRUCT(BlueprintType)
struct ENDER_API FEnderDamageEvent
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) TObjectPtr<AActor> Instigator = nullptr;
	UPROPERTY(BlueprintReadOnly) float Amount = 0.f;
	UPROPERTY(BlueprintReadOnly) float HealthLost = 0.f;
	UPROPERTY(BlueprintReadOnly) float StaggerAdded = 0.f;
	UPROPERTY(BlueprintReadOnly) bool bCrit = false;
	UPROPERTY(BlueprintReadOnly) bool bKilled = false;
	UPROPERTY(BlueprintReadOnly) EEnderHitWeight HitWeight = EEnderHitWeight::Normal;
	UPROPERTY(BlueprintReadOnly) bool bFirstUltimateImpact = false;
	/** Set when a normal enemy dealt it: an active Barrier then suppresses hit-stun (§27). */
	UPROPERTY(BlueprintReadOnly) bool bInterruptsOnBarrier = false;
	UPROPERTY(BlueprintReadOnly) FVector ImpactPoint = FVector::ZeroVector;
};

DECLARE_MULTICAST_DELEGATE_TwoParams(FEnderOnDamagedNative, UEnderAbilitySystemComponent* /*Victim*/, const FEnderDamageEvent&);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnDamaged, const FEnderDamageEvent&, Event);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnDied, AActor*, Killer);

/**
 * Ability activation always arrives here from UEnderCombatInputBuffer, never
 * straight from input (§18). TryActivateFromBuffer applies the cancel-window
 * rules: an active ability can be interrupted only while its montage has the
 * matching cancel window open (ANS_CancelWindow), or by death/hit reaction.
 */
UCLASS(ClassGroup = (Ender), meta = (BlueprintSpawnableComponent))
class ENDER_API UEnderAbilitySystemComponent : public UAbilitySystemComponent
{
	GENERATED_BODY()

public:
	UEnderAbilitySystemComponent();

	/** Returns true if the ability identified by AbilityTag activated (the buffered press is then consumed). */
	bool TryActivateFromBuffer(const FGameplayTag& AbilityTag, EEnderInputPriority Priority);

	/** Seconds left on the cooldown carrying CooldownTag, 0 if ready. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Abilities")
	float GetCooldownRemaining(const FGameplayTag& CooldownTag) const;

	UFUNCTION(BlueprintCallable, Category = "Ender|Abilities")
	bool IsAbilityActive(const FGameplayTag& AbilityTag) const;

	/** Adds/removes a loose tag with a count, used by notify-state windows. */
	void SetWindowTag(const FGameplayTag& Tag, bool bOpen);

	void NotifyDamaged(const FEnderDamageEvent& Event);

	/** Fired on the victim's ASC. */
	FEnderOnDamagedNative OnDamagedNative;
	/** Fired on the instigator's ASC with the victim: hit feel, Thread gain, Draught restores, telemetry. */
	FEnderOnDamagedNative OnDealtDamageNative;

	UPROPERTY(BlueprintAssignable, Category = "Ender|Combat") FEnderOnDamaged OnDamaged;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Combat") FEnderOnDied OnDied;

private:
	FGameplayAbilitySpec* FindSpecByTag(const FGameplayTag& AbilityTag);
	bool CancelActiveForNewRequest(const FGameplayAbilitySpec& Incoming, EEnderInputPriority Priority);
};
