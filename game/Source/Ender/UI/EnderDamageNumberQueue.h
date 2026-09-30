#pragma once

#include "CoreMinimal.h"
#include "Rules/DamageNumberRules.h"
#include "Subsystems/WorldSubsystem.h"
#include "EnderDamageNumberQueue.generated.h"

class AActor;
class AEnderCharacterBase;
class UEnderAbilitySystemComponent;
struct FEnderDamageEvent;

/** One number on screen, for the HUD to draw. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderDamageNumber
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|UI") int32 Id = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|UI") float Amount = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|UI") bool bCrit = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|UI") int32 Hits = 1;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|UI") FVector WorldLocation = FVector::ZeroVector;
	/** 0 at spawn → 1 at the end of its 0.65 s life. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|UI") float Life = 0.f;
	/** 18 px normal, 23 px crit. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|UI") int32 FontSize = 18;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|UI") FLinearColor Color = FLinearColor::White;
};

/**
 * Damage numbers for enemies: listens to every enemy's
 * UEnderAbilitySystemComponent::OnDamagedNative (enemies are picked up
 * automatically as they spawn) and keeps at most 18 numbers alive for 0.65 s,
 * folding same-frame repeated hits on one target once at the cap
 * (EnderRules::DamageNumbers::FQueue). Hits on the player are not shown.
 */
UCLASS()
class ENDER_API UEnderDamageNumberQueue : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	static UEnderDamageNumberQueue* Get(const UObject* WorldContext);

	virtual void OnWorldBeginPlay(UWorld& InWorld) override;
	virtual void Deinitialize() override;
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UEnderDamageNumberQueue, STATGROUP_Tickables); }

	/** Listen to this character's damage (called automatically for spawned and placed characters). */
	void Watch(AEnderCharacterBase* Character);

	/** Adds a number directly (tests, scripted damage). */
	void Push(uint32 TargetId, float Amount, bool bCrit, const FVector& WorldLocation);

	UFUNCTION(BlueprintPure, Category = "Ender|UI") TArray<FEnderDamageNumber> GetLiveNumbers() const;
	const EnderRules::DamageNumbers::FQueue& GetQueue() const { return Queue; }

	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SetEnabled(bool bInEnabled) { bEnabled = bInEnabled; if (!bEnabled) Queue.Clear(); }

private:
	void HandleActorSpawned(AActor* Actor);
	void HandleDamaged(UEnderAbilitySystemComponent* Victim, const FEnderDamageEvent& Event);

	EnderRules::DamageNumbers::FQueue Queue;
	TSet<TWeakObjectPtr<UEnderAbilitySystemComponent>> Watched;
	FDelegateHandle SpawnHandle;
	bool bEnabled = true;
};
