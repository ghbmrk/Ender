#pragma once

#include "Character/EnderCharacterBase.h"
#include "GameplayTagContainer.h"
#include "EnderPlayerCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UEnderCameraRigComponent;
class UEnderCombatInputBuffer;
class UMotionWarpingComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnDraughtsChanged, int32, Charges, int32, MaxCharges);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnHeavyDamageTaken, float, HealthLost);

/**
 * The Binder (§14), the only playable class. Capsule r 40 / h 175; 640 cm/s,
 * 3800 cm/s² acceleration, 5200 cm/s² deceleration. Movement and aim are independent:
 * the body faces the aim point, legs follow input. Thread regenerates 4/s and starts
 * each room at 50. No passive health regeneration; four Draughts.
 */
UCLASS()
class ENDER_API AEnderPlayerCharacter : public AEnderCharacterBase
{
	GENERATED_BODY()

public:
	AEnderPlayerCharacter(const FObjectInitializer& ObjectInitializer);

	// Aim and movement, set by AEnderPlayerController.
	void SetAimPoint(const FVector& WorldPoint);
	FVector GetAimPoint() const { return AimPoint; }
	void SetMovementInput(const FVector& WorldInput) { MovementInput = WorldInput; }
	/** Latest movement input in world space, magnitude 0–1 (Evade direction rule). */
	FVector GetMovementInput() const { return MovementInput; }
	void FaceDirection(const FVector& Direction);

	/** Ability-phase movement multiplier (ANS_MovementOverride or the fallback timeline). */
	void SetAbilityMoveMultiplier(float Multiplier) { AbilityMoveMultiplier = Multiplier; }
	float GetBaseMoveSpeed() const;

	/** Thread Lash chain bookkeeping: any other ability breaks the chain. */
	void NotifyAbilityActivated(const FGameplayTag& AbilityTag);
	bool ConsumeLashChainBreak();

	UFUNCTION(BlueprintCallable, Category = "Ender|Binder") void ResetThreadForRoom();

	UFUNCTION(BlueprintPure, Category = "Ender|Binder") int32 GetDraughtCharges() const { return DraughtCharges; }
	UFUNCTION(BlueprintPure, Category = "Ender|Binder") int32 GetMaxDraughtCharges() const { return MaxDraughtCharges; }
	bool ConsumeDraughtCharge();
	UFUNCTION(BlueprintCallable, Category = "Ender|Binder") void RestoreDraughtCharge();
	UFUNCTION(BlueprintCallable, Category = "Ender|Binder") void RefillDraughts();

	UEnderCombatInputBuffer* GetInputBuffer() const { return InputBuffer; }
	UEnderCameraRigComponent* GetCameraRig() const { return CameraRig; }

	UPROPERTY(BlueprintAssignable, Category = "Ender|Binder") FEnderOnDraughtsChanged OnDraughtsChanged;
	/** Player lost ≥20 HP in one hit: music ducks −2.5 dB over 0.18 s (§87), wired in the audio Blueprint. */
	UPROPERTY(BlueprintAssignable, Category = "Ender|Binder") FEnderOnHeavyDamageTaken OnHeavyDamageTaken;

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void HandleDamaged(const FEnderDamageEvent& Event) override;
	virtual void HandleDeath(AActor* Killer) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Camera") TObjectPtr<USpringArmComponent> SpringArm;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Camera") TObjectPtr<UCameraComponent> Camera;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Camera") TObjectPtr<UEnderCameraRigComponent> CameraRig;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Input") TObjectPtr<UEnderCombatInputBuffer> InputBuffer;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Combat") TObjectPtr<UMotionWarpingComponent> MotionWarping;

	UPROPERTY(EditDefaultsOnly, Category = "Ender|Binder") float TurnRateDegreesPerSecond = 1440.f;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Binder") int32 MaxDraughtCharges = 4;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Binder") float HeavyDamageThreshold = 20.f;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Binder") float HitStunDuration = 0.20f;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Binder") TObjectPtr<UAnimMontage> HitReactMontage;

private:
	void OnDealtDamage(UEnderAbilitySystemComponent* Victim, const FEnderDamageEvent& Event);
	void OnBarrierTagChanged(const FGameplayTag Tag, int32 NewCount);

	FVector AimPoint = FVector::ZeroVector;
	FVector MovementInput = FVector::ZeroVector;
	float AbilityMoveMultiplier = 1.f;
	bool bLashChainBroken = false;
	int32 DraughtCharges = 4;
};
