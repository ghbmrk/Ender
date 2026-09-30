#pragma once

#include "CoreMinimal.h"
#include "Core/EnderTypes.h"
#include "Engine/DataAsset.h"
#include "EnderEncounterDefinition.generated.h"

class UEnderEnemyDefinition;

/**
 * Authored overrides for one encounter room. Budgets, caps, role minimums and
 * wave split are rules (EnderRules::RulesFor / PlanEncounter) and not authored
 * here. Generated from Content/Data/encounters.json (DA_Encounter_Room1 … _Elite).
 */
UCLASS(BlueprintType)
class ENDER_API UEnderEncounterDefinition : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Encounter") EEnderRoomKind RoomKind = EEnderRoomKind::Room1;

	/** First-Realm roster: Keeper and Seer join from Room 3. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Encounter") bool bFirstRealmRoster = true;

	/** When set, only these archetypes may be planned (still subject to the roster rule and caps). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Encounter") bool bOverrideAllowedArchetypes = false;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Encounter", meta = (EditCondition = "bOverrideAllowedArchetypes"))
	TArray<EEnderArchetype> AllowedArchetypes;

	/** Enemy definition to spawn per archetype. Archetypes without one are never planned. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Encounter") TMap<EEnderArchetype, TObjectPtr<UEnderEnemyDefinition>> EnemyDefinitions;

	/** Mixed into the run's Encounter stream so two rooms of the same kind differ. 0 = use the stream as is. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Encounter") int32 SeedOffset = 0;

	virtual FPrimaryAssetId GetPrimaryAssetId() const override { return FPrimaryAssetId(TEXT("EnderEncounter"), GetFName()); }
};
