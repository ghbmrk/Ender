#pragma once

#include "CoreMinimal.h"
#include "Core/EnderTypes.h"
#include "GameFramework/Actor.h"
#include "Rules/EncounterRules.h"
#include "EnderEncounterDirector.generated.h"

class AEnderEncounterDirector;
class AEnderEnemyCharacter;
class AEnderSpawnPoint;
class UBoxComponent;
class UEnderEncounterDefinition;
class UEnderEnemyDefinition;
class UPrimitiveComponent;

UENUM(BlueprintType)
enum class EEnderEncounterState : uint8
{
	Idle,
	Active,
	Cleared,
};

/** Runtime bookkeeping of the director (not reflected). */
struct FEnderPendingSpawn
{
	EEnderArchetype Archetype = EEnderArchetype::Husk;
	EEnderEliteModifier Elite = EEnderEliteModifier::None;
	int32 Wave = 0;
	FVector Location = FVector::ZeroVector;
	bool bHasPoint = false;
	float TimeLeft = 0.f;
	TWeakObjectPtr<AActor> Telegraph;
};

struct FEnderLiveEnemy
{
	TWeakObjectPtr<AEnderEnemyCharacter> Enemy;
	EEnderArchetype Archetype = EEnderArchetype::Husk;
	bool bElite = false;
	int32 Wave = 0;
	double SpawnedAt = 0.0;
	bool bDead = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnRoomCleared, AEnderEncounterDirector*, Director, EEnderRoomKind, Room);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnRoomStarted, AEnderEncounterDirector*, Director, EEnderRoomKind, Room);

/**
 * One per combat room. Player enters RoomTrigger → doors lock → waves → clear →
 * loot → doors unlock → OnRoomCleared.
 *
 * Composition: EnderRules::PlanEncounter on the run's Encounter stream — budgets
 * 8/11/13/15/17, caps (Wisps 2, Seers 1, Keepers 2, normal 14), roles 1/2/2/3/3.
 * Waves: opening 65% of the spend, reinforcements (35%) when the opening wave is
 * down to ≤40% of its population or 14 s have passed. Every spawn is telegraphed
 * at its point for 1.5 s and re-validated when it materialises (≥400 cm from the
 * Binder, never within 300 cm behind them); an illegal point is re-picked and
 * re-telegraphed, never used. Points come from SpawnPoints, else the navmesh.
 */
UCLASS(Blueprintable)
class ENDER_API AEnderEncounterDirector : public AActor
{
	GENERATED_BODY()

public:
	AEnderEncounterDirector();

	UFUNCTION(BlueprintCallable, Category = "Ender|Encounter") void StartEncounter();
	/** Debug: kills nothing, just completes the room as if cleared. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Encounter") void ForceClear();

	UFUNCTION(BlueprintPure, Category = "Ender|Encounter") EEnderEncounterState GetState() const { return State; }
	UFUNCTION(BlueprintPure, Category = "Ender|Encounter") EEnderRoomKind GetRoomKind() const;
	UFUNCTION(BlueprintPure, Category = "Ender|Encounter") int32 GetAliveCount() const;
	UFUNCTION(BlueprintPure, Category = "Ender|Encounter") float GetElapsed() const;

	/**
	 * Editor check of the room geometry against the spec: combat area ≥1800×1600
	 * (typical 2400×2000), corridors ≥450 cm at CorridorProbes, obstacle coverage
	 * 10–22% of the combat area. Writes LastValidationReport and the log.
	 */
	UFUNCTION(CallInEditor, BlueprintCallable, Category = "Ender|Encounter") void ValidateRoom();

	UPROPERTY(BlueprintAssignable, Category = "Ender|Encounter") FEnderOnRoomStarted OnRoomStarted;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Encounter") FEnderOnRoomCleared OnRoomCleared;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") EEnderRoomKind RoomKind = EEnderRoomKind::Room1;
	/** Optional authored overrides; its RoomKind wins when set. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") TObjectPtr<UEnderEncounterDefinition> Definition;
	/** Used for archetypes the Definition does not name. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") TMap<EEnderArchetype, TObjectPtr<UEnderEnemyDefinition>> EnemyDefinitions;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") bool bFirstRealmRoster = true;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") TArray<TObjectPtr<AEnderSpawnPoint>> SpawnPoints;
	/** Door actors: shown and colliding while the room is locked (override SetDoorsLocked in Blueprint for animation). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") TArray<TObjectPtr<AActor>> Doors;
	/** Actor spawned at a spawn point for the 1.5 s telegraph (NS ink bloom); destroyed when the enemy appears. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") TSubclassOf<AActor> SpawnTelegraphClass;
	/** Room-local points in corridors/doorways whose clear width ValidateRoom measures. */
	UPROPERTY(EditAnywhere, Category = "Ender|Validation", meta = (MakeEditWidget = "true")) TArray<FVector> CorridorProbes;
	UPROPERTY(VisibleInstanceOnly, Category = "Ender|Validation") FString LastValidationReport;

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UFUNCTION(BlueprintNativeEvent, Category = "Ender|Encounter") void SetDoorsLocked(bool bLocked);
	/** Spawn telegraph presentation (in addition to SpawnTelegraphClass). */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Encounter") void OnSpawnTelegraph(FVector Location, EEnderArchetype Archetype, bool bElite);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Encounter") void OnReinforcements();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") TObjectPtr<UBoxComponent> RoomTrigger;
	/** The combat floor: spawn area, navmesh query extent and geometry validation. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Encounter") TObjectPtr<UBoxComponent> CombatArea;

private:
	UFUNCTION() void HandleTriggerOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp,
		int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);
	UFUNCTION() void HandleEnemyDied(AEnderEnemyCharacter* Enemy, AActor* Killer);

	const UEnderEnemyDefinition* ResolveDefinition(EEnderArchetype Archetype) const;
	EnderRules::FRoomRules BuildRules() const;
	void QueueWave(int32 Wave);
	void Telegraph(FEnderPendingSpawn& P);
	bool PickSpawnPoint(EEnderArchetype Archetype, bool bElite, FVector& Out);
	bool IsSpawnLegalNow(const FVector& Point) const;
	void Materialise(FEnderPendingSpawn& P);
	void Clear();
	int32 ServiceRoomIndex() const;
	FVector RoomCentre() const;

	EEnderEncounterState State = EEnderEncounterState::Idle;
	EnderRules::FEncounterPlan Plan;
	TArray<FEnderPendingSpawn> Pending;
	TArray<FEnderLiveEnemy> Live;
	int32 OpeningPopulation = 0;
	bool bReinforced = false;
	double StartedAt = 0.0;
	FVector LastKillLocation = FVector::ZeroVector;
};
