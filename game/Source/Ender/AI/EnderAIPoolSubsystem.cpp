#include "AI/EnderAIPoolSubsystem.h"

#include "AI/EnderAISettings.h"
#include "AI/EnderEnemyProjectile.h"
#include "AI/EnderHazardPool.h"
#include "AI/EnderTelegraph.h"
#include "Engine/World.h"
#include "Rules/EnemyAIRules.h"

namespace
{
	bool IsBusy(const AEnderTelegraph* A) { return A->IsLive(); }
	bool IsBusy(const AEnderEnemyProjectile* A) { return A->IsInFlight(); }
	bool IsBusy(const AEnderHazardPool* A) { return A->IsLive(); }
}

UEnderAIPoolSubsystem* UEnderAIPoolSubsystem::Get(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	return World ? World->GetSubsystem<UEnderAIPoolSubsystem>() : nullptr;
}

template <typename T>
T* UEnderAIPoolSubsystem::AcquireFrom(TArray<TObjectPtr<T>>& Pool, TSubclassOf<T>& CachedClass, const TSoftClassPtr<T>& Configured, int32 Cap)
{
	int32 Busy = 0;
	T* Free = nullptr;
	for (int32 I = Pool.Num() - 1; I >= 0; --I)
	{
		T* Item = Pool[I];
		if (!IsValid(Item))
		{
			Pool.RemoveAtSwap(I);
			continue;
		}
		if (IsBusy(Item)) ++Busy;
		else if (!Free) Free = Item;
	}
	if (Busy >= Cap) return nullptr;
	if (Free) return Free;

	UWorld* World = GetWorld();
	if (!World || World->bIsTearingDown) return nullptr;
	if (!CachedClass)
	{
		UClass* Loaded = Configured.IsNull() ? nullptr : Configured.LoadSynchronous();
		CachedClass = Loaded ? Loaded : T::StaticClass();
	}
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	T* Spawned = World->SpawnActor<T>(CachedClass, FTransform::Identity, Params);
	if (Spawned) Pool.Add(Spawned);
	return Spawned;
}

AEnderTelegraph* UEnderAIPoolSubsystem::AcquireTelegraph()
{
	return AcquireFrom(Telegraphs, TelegraphClass, GetDefault<UEnderAISettings>()->TelegraphClass, EnderRules::EnemyLimits::MaxTelegraphs);
}

AEnderEnemyProjectile* UEnderAIPoolSubsystem::AcquireProjectile()
{
	return AcquireFrom(Projectiles, ProjectileClass, GetDefault<UEnderAISettings>()->ProjectileClass, EnderRules::EnemyLimits::MaxEnemyProjectiles);
}

AEnderHazardPool* UEnderAIPoolSubsystem::AcquireHazard()
{
	return AcquireFrom(Hazards, HazardClass, GetDefault<UEnderAISettings>()->HazardPoolClass, EnderRules::EnemyLimits::MaxHazardPools);
}

int32 UEnderAIPoolSubsystem::CountLiveHazards(const AActor* Source) const
{
	int32 N = 0;
	for (const AEnderHazardPool* H : Hazards)
	{
		if (IsValid(H) && H->IsLive() && H->GetSource() == Source) ++N;
	}
	return N;
}

int32 UEnderAIPoolSubsystem::CountProjectilesInFlight() const
{
	int32 N = 0;
	for (const AEnderEnemyProjectile* P : Projectiles)
	{
		if (IsValid(P) && P->IsInFlight()) ++N;
	}
	return N;
}

void UEnderAIPoolSubsystem::CancelAllFrom(const AActor* Source)
{
	if (!Source) return;
	for (AEnderTelegraph* T : Telegraphs)
	{
		if (IsValid(T) && T->IsLive() && T->GetSource() == Source) T->Cancel();
	}
	for (AEnderEnemyProjectile* P : Projectiles)
	{
		if (IsValid(P) && P->IsInFlight() && P->GetSource() == Source) P->Deactivate();
	}
	for (AEnderHazardPool* H : Hazards)
	{
		if (IsValid(H) && H->IsLive() && H->GetSource() == Source) H->Deactivate();
	}
}

void UEnderAIPoolSubsystem::CancelAllProjectiles()
{
	for (AEnderEnemyProjectile* P : Projectiles)
	{
		if (IsValid(P) && P->IsInFlight()) P->Deactivate();
	}
}

void UEnderAIPoolSubsystem::Deinitialize()
{
	Telegraphs.Reset();
	Projectiles.Reset();
	Hazards.Reset();
	Super::Deinitialize();
}
