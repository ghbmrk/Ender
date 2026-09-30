#pragma once

#include "AbilitySystemInterface.h"
#include "GameFramework/Character.h"
#include "EnderCharacterBase.generated.h"

class UEnderAbilitySystemComponent;
class UEnderAttributeSet;
class UEnderTargetSweepComponent;
class UGameplayAbility;
struct FEnderDamageEvent;

/**
 * Shared by the Binder, the Hushed and the Bound King: owns the ability system
 * and attributes, the outline stencil, hit flash and the death sequence
 * (0.75–1.25 s death, pigment breakup, corpse gone 3 s after death, §85).
 */
UCLASS(Abstract)
class ENDER_API AEnderCharacterBase : public ACharacter, public IAbilitySystemInterface
{
	GENERATED_BODY()

public:
	AEnderCharacterBase(const FObjectInitializer& ObjectInitializer);

	virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;
	UEnderAbilitySystemComponent* GetEnderASC() const { return AbilitySystem; }
	const UEnderAttributeSet* GetAttributes() const { return Attributes; }
	UEnderTargetSweepComponent* GetTargetSweep() const { return TargetSweep; }

	UFUNCTION(BlueprintPure, Category = "Ender")
	bool IsAlive() const;

	/** Custom stencil for the ink outline (§80): 1 player, 2 enemy, 3 elite, 4 boss. */
	void SetOutlineStencil(int32 Stencil);

	/** Flash the mesh via the "HitFlash" scalar on its dynamic materials for Duration seconds. */
	void PlayHitFlash(float Duration);

	/** Local animation pause for heavy hits (§32): custom time dilation, not global. */
	void PauseAnimation(float Duration);

	/** Grants the abilities in StartupAbilities. Called once the ASC has its actor info. */
	void GrantStartupAbilities();

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void PossessedBy(AController* NewController) override;

	/** Override to react; call Super. Plays DeathMontage, disables collision, schedules breakup and removal. */
	virtual void HandleDeath(AActor* Killer);
	virtual void HandleDamaged(const FEnderDamageEvent& Event);

	/** Blueprint hooks for Niagara/audio (NS_PigmentDeath etc. live in content). */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender") void OnDamagedCue(const FEnderDamageEvent& Event);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender") void OnDeathStarted(AActor* Killer);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender") void OnPigmentBreakup();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender") TObjectPtr<UEnderAbilitySystemComponent> AbilitySystem;
	UPROPERTY() TObjectPtr<UEnderAttributeSet> Attributes;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender") TObjectPtr<UEnderTargetSweepComponent> TargetSweep;

	UPROPERTY(EditDefaultsOnly, Category = "Ender|Abilities") TArray<TSubclassOf<UGameplayAbility>> StartupAbilities;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Death") TObjectPtr<UAnimMontage> DeathMontage;
	/** Death animation length used when no montage is set; clamped to the spec's 0.75–1.25 s. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Death", meta = (ClampMin = "0.75", ClampMax = "1.25")) float DeathDuration = 1.0f;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Death") float CorpseLifetime = 3.0f;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Outline") int32 OutlineStencil = 0;

private:
	void OnDamagedNative(UEnderAbilitySystemComponent* Victim, const FEnderDamageEvent& Event);
	UFUNCTION() void OnDiedDynamic(AActor* Killer);

	bool bAbilitiesGranted = false;
	float FlashLeft = 0.f;
	float PauseLeft = 0.f;
	TArray<TObjectPtr<UMaterialInstanceDynamic>> FlashMaterials;
	FTimerHandle BreakupTimer;
};
