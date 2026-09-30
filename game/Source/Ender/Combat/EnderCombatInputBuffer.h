#pragma once

#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "Core/EnderTypes.h"
#include "Rules/InputBufferCore.h"
#include "EnderCombatInputBuffer.generated.h"

USTRUCT(BlueprintType)
struct ENDER_API FEnderBufferedAction
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag AbilityTag;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) EEnderInputPriority Priority = EEnderInputPriority::Skill;
};

/**
 * §18: Enhanced Input → CombatInputBuffer → ability request → GAS activation check →
 * execute or keep buffered. A press lives 120 ms; only the newest press per ability
 * is kept; each tick the live requests are tried in priority order (Death > Hit
 * Reaction > Evade > Defensive > Other > Basic > Movement) and the first that
 * activates is consumed. Held buttons re-press every frame, so holding LMB chains Lashes.
 */
UCLASS(ClassGroup = (Ender), meta = (BlueprintSpawnableComponent))
class ENDER_API UEnderCombatInputBuffer : public UActorComponent
{
	GENERATED_BODY()

public:
	static constexpr int32 MaxSlots = 8;

	UEnderCombatInputBuffer();

	/** Slot indices: 0–5 Skills 1–6, 6 Evade, 7 Draught. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Input")
	void Press(int32 Slot);

	UFUNCTION(BlueprintCallable, Category = "Ender|Input")
	void ClearAll();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Input")
	TArray<FEnderBufferedAction> Slots;

	/** Seconds a press stays buffered. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Input")
	float Lifetime = 0.120f;

	/** Last slot that activated and when (world seconds): input-latency telemetry. */
	int32 GetLastActivatedSlot() const { return LastActivatedSlot; }

private:
	EnderRules::TInputBufferCore<MaxSlots> Core;
	int32 LastActivatedSlot = -1;
};
