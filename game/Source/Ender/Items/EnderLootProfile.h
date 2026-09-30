#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "EnderLootProfile.generated.h"

class AEnderLootDrop;

/**
 * Presentation and bundle sizes for loot. Drop *rates* are rules (Rules/LootRules.h:
 * Room 2 35%, Room 3 50%, Room 4 65%, Elite 100%, Boss exactly 2, Essence bundle
 * every 5–8 normal kills) and are not authored here. Generated from
 * Content/Data/loot.json as /Game/Data/DA_LootProfile_Default.
 */
UCLASS(BlueprintType)
class ENDER_API UEnderLootProfile : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Loot") TSubclassOf<AEnderLootDrop> LootDropClass;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Loot", meta = (ClampMin = "1")) int32 EssenceBundleMin = 2;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Loot", meta = (ClampMin = "1")) int32 EssenceBundleMax = 4;
	/** Crowns dropped on room clear (none on Room 1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Loot", meta = (ClampMin = "0")) int32 RoomClearCrowns = 12;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Loot", meta = (ClampMin = "0")) int32 BossCrowns = 60;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Loot", meta = (ClampMin = "0", Units = "cm")) float ScatterRadius = 140.f;
	/** Names for ordinary (offline) items per gear slot: Blade, Ward, Sigil, Charm. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Offline") TArray<FText> OrdinaryNames;

	virtual FPrimaryAssetId GetPrimaryAssetId() const override { return FPrimaryAssetId(TEXT("EnderLootProfile"), GetFName()); }
};
