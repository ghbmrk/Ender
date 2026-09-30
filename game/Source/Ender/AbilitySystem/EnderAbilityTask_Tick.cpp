#include "AbilitySystem/EnderAbilityTask_Tick.h"

UEnderAbilityTask_Tick::UEnderAbilityTask_Tick(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	bTickingTask = true;
}

UEnderAbilityTask_Tick* UEnderAbilityTask_Tick::TickEveryFrame(UGameplayAbility* OwningAbility)
{
	return NewAbilityTask<UEnderAbilityTask_Tick>(OwningAbility);
}

void UEnderAbilityTask_Tick::TickTask(float DeltaTime)
{
	Super::TickTask(DeltaTime);
	if (ShouldBroadcastAbilityTaskDelegates()) OnTick.Broadcast(DeltaTime);
}
