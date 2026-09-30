#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "EnderGameMode.generated.h"

class UEnderLootProfile;

/**
 * One game mode for the Crossing and the Realms. A map containing an
 * AEnderEncounterDirector or AEnderBossArena is a Realm: StartPlay starts it from
 * the prefetch UEnderGameInstance::EnterRealm stored (or offline when the map was
 * opened directly, e.g. PIE). Controller input events are bound by AEnderHUD.
 */
UCLASS()
class ENDER_API AEnderGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AEnderGameMode();

	/** BP_Binder when it exists, else the native AEnderPlayerCharacter. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Classes") TSoftClassPtr<APawn> PlayerPawnClass;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Loot") TSoftObjectPtr<UEnderLootProfile> LootProfile;
	/** Force Realm mode regardless of placed actors. */
	UPROPERTY(EditAnywhere, Category = "Ender|Realm") bool bForceRealm = false;

	virtual UClass* GetDefaultPawnClassForController_Implementation(AController* InController) override;
	virtual void StartPlay() override;
	virtual void SetPlayerDefaults(APawn* PlayerPawn) override;

	UFUNCTION(BlueprintPure, Category = "Ender|Realm") bool IsRealmMap() const;
};
