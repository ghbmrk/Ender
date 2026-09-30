#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "EnderAIPoolSubsystem.generated.h"

class AEnderTelegraph;
class AEnderEnemyProjectile;
class AEnderHazardPool;

/**
 * Pools the actors combat spawns every few seconds and enforces the performance
 * caps: ≤24 enemy projectiles, and telegraph + hazard counts that keep active
 * Niagara under 60 (each owns one system). Acquire returns null at a cap; the
 * caller treats that as an aborted attack. Actors go back to the pool on their
 * own when they finish (they report IsLive/IsInFlight false).
 */
UCLASS()
class ENDER_API UEnderAIPoolSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	static UEnderAIPoolSubsystem* Get(const UObject* WorldContext);

	AEnderTelegraph* AcquireTelegraph();
	AEnderEnemyProjectile* AcquireProjectile();
	AEnderHazardPool* AcquireHazard();

	int32 CountLiveHazards(const AActor* Source) const;
	int32 CountProjectilesInFlight() const;

	/** Ends everything Source has in the world: telegraphs, shots and pools (boss transitions, room reset). */
	void CancelAllFrom(const AActor* Source);

	/** Ends every enemy shot in flight (player-safe windows). */
	void CancelAllProjectiles();

	virtual void Deinitialize() override;

private:
	template <typename T>
	T* AcquireFrom(TArray<TObjectPtr<T>>& Pool, TSubclassOf<T>& CachedClass, const TSoftClassPtr<T>& Configured, int32 Cap);

	UPROPERTY() TArray<TObjectPtr<AEnderTelegraph>> Telegraphs;
	UPROPERTY() TArray<TObjectPtr<AEnderEnemyProjectile>> Projectiles;
	UPROPERTY() TArray<TObjectPtr<AEnderHazardPool>> Hazards;

	UPROPERTY() TSubclassOf<AEnderTelegraph> TelegraphClass;
	UPROPERTY() TSubclassOf<AEnderEnemyProjectile> ProjectileClass;
	UPROPERTY() TSubclassOf<AEnderHazardPool> HazardClass;
};
