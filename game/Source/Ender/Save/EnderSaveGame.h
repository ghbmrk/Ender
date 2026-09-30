#pragma once

#include "CoreMinimal.h"
#include "Economy/EnderEconomyTypes.h"
#include "GameFramework/SaveGame.h"
#include "Items/EnderFormTypes.h"
#include "Reality/EnderRealityTypes.h"
#include "EnderSaveGame.generated.h"

USTRUCT(BlueprintType)
struct ENDER_API FEnderUserSettings
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Ender|Settings") float MasterVolume = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Ender|Settings") float MusicVolume = 0.8f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Ender|Settings") float EffectsVolume = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Ender|Settings") bool bShowDamageNumbers = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Ender|Settings") bool bScreenShake = true;
	/** 0–1 between the camera's near and far zoom. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Ender|Settings") float CameraZoom = 0.5f;
	/** Hold Alt for loot labels (default) or toggle. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Ender|Settings") bool bLootLabelsToggle = false;
};

/** One gear slot → the Form equipped in it (local id). */
USTRUCT(BlueprintType)
struct ENDER_API FEnderEquippedEntry
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") EEnderGearSlot Slot = EEnderGearSlot::Blade;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") FGuid FormId;
};

/**
 * The local save: character progress as last reported by the service, the
 * inventory and equipment (authoritative for offline play), the world replay
 * date and settings. The reality service keeps its own record; this one lets
 * the slice run with the service off.
 */
UCLASS()
class ENDER_API UEnderSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY(SaveGame) int32 SaveVersion = 1;

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") FEnderCharacterProgress Character;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") TArray<FString> PassiveAllocations;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") FEnderMasterySnapshot Mastery;

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") TArray<FEnderForm> Forms;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") TArray<FEnderEssenceAmount> Essences;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") TArray<FEnderEquippedEntry> Equipped;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") int32 Crowns = 0;

	/** Current world replay date (YYYY-MM-DD) and snapshot. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") FString WorldReplayDate;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") FString WorldSnapshotId;

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") FEnderUserSettings Settings;

	/** The first Realm guarantees the Room 2 Veiled Form. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") bool bTutorialComplete = false;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") int32 RealmsCompleted = 0;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Save") int32 BossKills = 0;

	/** Shrine crafting done inside a Realm, waiting to reach the service. */
	UPROPERTY(SaveGame) TArray<FEnderDeferredRequest> DeferredRequests;
};
