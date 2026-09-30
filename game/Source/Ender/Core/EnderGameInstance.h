#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "EnderGameInstance.generated.h"

struct FEnderRealmPrefetch;

/**
 * Travels between the Crossing and the Realms. EnterRealm prefetches everything the
 * Realm needs (UEnderRealityClient::PrefetchRealmNative, falling back offline) and
 * only then opens the Realm map, so nothing is requested once combat can start.
 */
UCLASS()
class ENDER_API UEnderGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	UEnderGameInstance();

	/** Realm id → map. Unlisted Realms use DefaultRealmMap. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Travel") TMap<FString, TSoftObjectPtr<UWorld>> RealmMaps;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Travel") TSoftObjectPtr<UWorld> DefaultRealmMap;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Travel") TSoftObjectPtr<UWorld> CrossingMap;

	/** Realm Gate → prefetch → open the Realm map. Returns false while already travelling. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Travel") bool EnterRealm(const FString& RealmId, bool bEconomyDriven);
	/** Back to the Crossing after Delay seconds (death, Return Portal). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Travel") void ReturnToCrossing(float Delay);
	UFUNCTION(BlueprintPure, Category = "Ender|Travel") bool IsTravelling() const { return bTravelling; }

protected:
	virtual void Init() override;

	/** Prefetch started (show a loading veil); bOnline false when the Realm will run offline. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Travel") void OnRealmLoading(const FString& RealmId);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Travel") void OnRealmReady(const FString& RealmId, bool bOnline);

private:
	void HandlePrefetched(bool bOnline, const FEnderRealmPrefetch& Prefetch);
	void OpenCrossing();

	FString PendingRealmId;
	bool bTravelling = false;
	FTimerHandle ReturnTimer;
};
