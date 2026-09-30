#pragma once

#include "CoreMinimal.h"
#include "Economy/EnderEconomyTypes.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "EnderSaveSubsystem.generated.h"

class UEnderSaveGame;

namespace EnderSave
{
	inline const TCHAR* SlotName = TEXT("Ender_Slot0");
	constexpr int32 UserIndex = 0;
}

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnSaved, bool, bSuccess);

/**
 * Owns the single save slot. Loads synchronously at startup (before any Realm),
 * saves asynchronously so writing never hitches a frame. Mirrors character and
 * world data reported by the reality client, so the Crossing shows the last
 * known state when the service is off.
 */
UCLASS()
class ENDER_API UEnderSaveSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	static UEnderSaveSubsystem* Get(const UObject* WorldContext);

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	UFUNCTION(BlueprintPure, Category = "Ender|Save") UEnderSaveGame* GetSave() const { return Save; }

	/** Writes the slot. Safe to call often; overlapping saves coalesce into one follow-up write. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Save") void SaveNow();

	/** Deletes the slot and starts a fresh save (new character). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Save") void ResetSave();

	UPROPERTY(BlueprintAssignable, Category = "Ender|Save") FEnderOnSaved OnSaved;

private:
	UFUNCTION() void HandleCharacterUpdated(const FEnderCharacterProgress& Character);
	UFUNCTION() void HandleWorldUpdated(const FEnderWorldState& World);
	void HandleAsyncSaved(const FString& Slot, int32 User, bool bSuccess);

	UPROPERTY() TObjectPtr<UEnderSaveGame> Save;
	bool bSaveInFlight = false;
	bool bSaveAgain = false;
};
