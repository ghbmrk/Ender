#pragma once

#include "Abilities/Tasks/AbilityTask.h"
#include "EnderAbilityTask_Tick.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderAbilityTickDelegate, float, DeltaTime);

/** Per-frame callback while the ability runs (Unravel's expanding query, Grand Fracture's strikes, the timing fallback). */
UCLASS()
class ENDER_API UEnderAbilityTask_Tick : public UAbilityTask
{
	GENERATED_BODY()

public:
	UEnderAbilityTask_Tick(const FObjectInitializer& ObjectInitializer);

	UPROPERTY(BlueprintAssignable) FEnderAbilityTickDelegate OnTick;

	UFUNCTION(BlueprintCallable, Category = "Ability|Tasks", meta = (HidePin = "OwningAbility", DefaultToSelf = "OwningAbility", BlueprintInternalUseOnly = "true"))
	static UEnderAbilityTask_Tick* TickEveryFrame(UGameplayAbility* OwningAbility);

	virtual void TickTask(float DeltaTime) override;
};
