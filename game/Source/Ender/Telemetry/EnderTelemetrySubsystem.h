#pragma once

#include "CoreMinimal.h"
#include "Core/EnderTypes.h"
#include "Items/EnderFormTypes.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "EnderTelemetrySubsystem.generated.h"

class FJsonObject;

USTRUCT(BlueprintType)
struct ENDER_API FEnderTelemetryWarning
{
	GENERATED_BODY()

	/** skill-underused | skill-overused | rooms-too-slow | rooms-too-fast | offscreen-hits | boss-too-slow */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Telemetry") FString Code;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Telemetry") FString Message;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Telemetry") float Value = 0.f;
	/** Skill slot (1–6) for skill warnings, else 0. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Telemetry") int32 SkillSlot = 0;
};

/**
 * Playtest telemetry. Other systems call the Record* functions; each call appends
 * a JSON line (buffered, flushed at room clear and shutdown) to
 * Saved/Telemetry/session-<time>.jsonl and updates the aggregates behind
 * ComputeWarnings(): skill share <5% or >45%, median room >55 s or <15 s, any
 * off-screen hit, median boss first kill >150 s.
 */
UCLASS()
class ENDER_API UEnderTelemetrySubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	static UEnderTelemetrySubsystem* Get(const UObject* WorldContext);

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordRoomStarted(EEnderRoomKind Room);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordRoomDuration(EEnderRoomKind Room, float Seconds);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordTimeToKill(EEnderArchetype Archetype, bool bElite, float Seconds);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordDamageTaken(FName AttackId, float Amount);
	/** bSuccess: an incoming attack landed inside the Evade's invulnerability. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordEvade(bool bSuccess);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordDeath(FName Cause);
	/** Slot 1–6 on the skill bar; 0 = Evade (not counted toward skill share). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordAbilityUse(int32 Slot, FName AbilityName);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordThreadCapped(float Seconds);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordThreadEmpty(float Seconds);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordBossPhase(int32 Phase, float Seconds);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordBossKill(float Seconds, bool bFirstKill);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordOffscreenHit(FName AttackerName);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordLootDropped(EEnderLootKind Kind);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordLootPickedUp(EEnderLootKind Kind);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordFormInspected(const FString& CandidateId);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordFormEquipped(const FString& CandidateId, EEnderGearSlot Slot);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordTemperSelection(const FString& Emphasis);
	/** bEconomyDriven: the chosen Realm carried the strongest bounty / demand on the Gate. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordRealmSelection(const FString& RealmId, bool bEconomyDriven);
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void RecordRealmPacing(float ActiveSeconds, float CombatShare);

	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") TArray<FEnderTelemetryWarning> ComputeWarnings() const;
	UFUNCTION(BlueprintPure, Category = "Ender|Telemetry") float GetLootPickupRate() const;
	UFUNCTION(BlueprintPure, Category = "Ender|Telemetry") float GetEvadeSuccessRate() const;

	/** Writes buffered lines. Called at room clear, Realm end and shutdown; never needed mid-fight. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Telemetry") void Flush();

private:
	void Write(const FString& Type, const TSharedRef<FJsonObject>& Fields);

	FString FilePath;
	TArray<FString> Buffer;
	double SessionStart = 0.0;
	double LastFightEnded = -1.0;

	TArray<int32> SkillUses;
	TArray<double> RoomDurations;
	TArray<double> BossFirstKills;
	int32 OffscreenHits = 0;
	int32 EvadeAttempts = 0;
	int32 EvadeSuccesses = 0;
	int32 LootDropped = 0;
	int32 LootPickedUp = 0;
	int32 FormsInspected = 0;
	int32 FormsEquipped = 0;
	int32 EconomyRealmChoices = 0;
	int32 RealmChoices = 0;
	double ThreadCappedSeconds = 0.0;
	double ThreadEmptySeconds = 0.0;
};
