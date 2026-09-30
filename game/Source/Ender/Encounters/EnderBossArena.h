#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "EnderBossArena.generated.h"

class AEnderBoundKing;
class UArrowComponent;
class UBoxComponent;
class UEnderEnemyDefinition;
class UPrimitiveComponent;

/**
 * The Bound King's arena. On entry: locks the doors, spawns (or wakes) the boss
 * with the Realm's tutorial flag, and reports engagement, phase changes and the
 * kill to UEnderRealmSubsystem (which drops the two boss Forms and opens the
 * Reward Altar).
 */
UCLASS(Blueprintable)
class ENDER_API AEnderBossArena : public AActor
{
	GENERATED_BODY()

public:
	AEnderBossArena();

	UFUNCTION(BlueprintCallable, Category = "Ender|Boss") void Engage();

	/** Boss definition (DA_Enemy_BoundKing); its EnemyClass must be an AEnderBoundKing. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Boss") TObjectPtr<UEnderEnemyDefinition> BossDefinition;
	/** Alternatively a boss already placed in the level (spawned hidden until Engage). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Boss") TObjectPtr<AEnderBoundKing> PlacedBoss;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Boss") TArray<TObjectPtr<AActor>> Doors;

protected:
	virtual void BeginPlay() override;

	UFUNCTION(BlueprintNativeEvent, Category = "Ender|Boss") void SetDoorsLocked(bool bLocked);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Boss") void OnBossSpawned(AEnderBoundKing* Boss);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Boss") TObjectPtr<UBoxComponent> Trigger;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Boss") TObjectPtr<UArrowComponent> BossSpawn;

private:
	UFUNCTION() void HandleTriggerOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp,
		int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);
	UFUNCTION() void HandleBossDefeated(AEnderBoundKing* Boss);
	UFUNCTION() void HandlePhaseChanged(AEnderBoundKing* Boss, int32 NewPhase);

	UPROPERTY() TObjectPtr<AEnderBoundKing> Boss;
	bool bEngaged = false;
};
