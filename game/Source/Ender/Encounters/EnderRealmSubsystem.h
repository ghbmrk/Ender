#pragma once

#include "CoreMinimal.h"
#include "Core/EnderTypes.h"
#include "Reality/EnderRealityTypes.h"
#include "Rules/RealmFlowRules.h"
#include "Subsystems/WorldSubsystem.h"
#include "EnderRealmSubsystem.generated.h"

class AEnderEncounterDirector;
class UEnderLootProfile;

static_assert(static_cast<int>(EEnderRealmSegment::ReturnPortal) == static_cast<int>(EnderRules::ERealmSegment::ReturnPortal));

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnSegmentChanged, EEnderRealmSegment, From, EEnderRealmSegment, To);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnFocusChanged, int32, Current, int32, Max);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnRealmEnded, const FString&, Outcome);

/**
 * The Realm, start to finish, in its exact order:
 *   Entry → Room 1 → Connector → Room 2 → Attunement Shrine → Room 3 → Room 4 →
 *   Elite → Recovery Space → Boss → Reward Altar → Return Portal
 * A segment can only be entered from the one before it. Pacing targets (first
 * completion 7–10 min, normal room 25–40 s, elite 45–65 s, travel 4–10 s, combat
 * ≈70% of active time) are recorded to telemetry, not enforced. Focus: 12 per
 * Realm, spent by Familiar actions at the shrine (Attune 1, Fracture 1, Temper 2,
 * Mirror 2, Deep Trial 3).
 */
UCLASS()
class ENDER_API UEnderRealmSubsystem : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	static UEnderRealmSubsystem* Get(const UObject* WorldContext);

	/** Seeds the run, refreshes Focus, arms the loot subsystem and gates the reality client. */
	void StartRealm(const FEnderRealmPrefetch& Prefetch, UEnderLootProfile* LootProfile);
	/** Uses the reality client's prefetch, or an offline prefetch when there is none. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") void StartRealmFromPrefetch(UEnderLootProfile* LootProfile);

	UFUNCTION(BlueprintPure, Category = "Ender|Realm") bool IsRealmActive() const { return bActive; }
	UFUNCTION(BlueprintPure, Category = "Ender|Realm") bool IsTutorial() const { return Prefetch.bTutorial; }
	UFUNCTION(BlueprintPure, Category = "Ender|Realm") bool IsOffline() const { return Prefetch.bOffline; }
	UFUNCTION(BlueprintPure, Category = "Ender|Realm") EEnderRealmSegment GetSegment() const { return Segment; }
	UFUNCTION(BlueprintPure, Category = "Ender|Realm") FString GetRealmId() const { return Prefetch.RealmId; }

	/** True for the current segment or the one directly after it. */
	UFUNCTION(BlueprintPure, Category = "Ender|Realm") bool CanEnterSegment(EEnderRealmSegment Target) const;
	/** Moves to Target if it is the next segment; returns false (and stays) otherwise. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") bool AdvanceTo(EEnderRealmSegment Target);

	// Encounter / boss hooks
	void NotifyRoomStarted(AEnderEncounterDirector* Director);
	void NotifyRoomCleared(AEnderEncounterDirector* Director, float Seconds);
	void NotifyEnemyKilled(EEnderArchetype Archetype);
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") void NotifyBossEngaged(AActor* Boss);
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") void NotifyBossPhase(int32 NewPhase);
	/** Drops the boss rewards (exactly two Forms) at the boss and opens the Reward Altar. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") void NotifyBossDefeated(AActor* Boss);
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") void NotifyPlayerDied(FName Cause);

	// Interactables
	/** Reward Altar: banks cleared rooms with the service (fire and forget). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") void ClaimRewardAltar();
	/** Return Portal: completes the run and travels back to the Crossing. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") void UseReturnPortal();

	// Focus and the shrine
	UFUNCTION(BlueprintPure, Category = "Ender|Realm") int32 GetFocus() const { return Focus.Current; }
	UFUNCTION(BlueprintPure, Category = "Ender|Realm") int32 GetMaxFocus() const { return Focus.Max; }
	UFUNCTION(BlueprintPure, Category = "Ender|Realm") bool CanAfford(EEnderFamiliarAction Action) const { return Focus.CanAfford(EnderConvert::ToRules(Action)); }
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") bool TrySpendFocus(EEnderFamiliarAction Action);
	/**
	 * Attune at the shrine: spends 1 Focus, reveals the Form locally from prefetched
	 * data (no network in a Realm) and queues the service Attune for after the Realm.
	 */
	UFUNCTION(BlueprintCallable, Category = "Ender|Realm") bool AttuneAtShrine(APawn* Binder, const FGuid& FormId, TArray<FText>& OutFamiliarLines);

	UPROPERTY(BlueprintAssignable, Category = "Ender|Realm") FEnderOnSegmentChanged OnSegmentChanged;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Realm") FEnderOnFocusChanged OnFocusChanged;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Realm") FEnderOnRealmEnded OnRealmEnded;

	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UEnderRealmSubsystem, STATGROUP_Tickables); }
	virtual bool IsTickable() const override { return bActive; }

private:
	void SetSegment(EEnderRealmSegment Target);
	void EndRealm(const FString& Outcome);

	FEnderRealmPrefetch Prefetch;
	bool bActive = false;
	EEnderRealmSegment Segment = EEnderRealmSegment::Entry;
	EnderRules::FFocusWallet Focus;
	EnderRules::FPacingLog Pacing;
	double SegmentSeconds = 0.0;
	double CombatSeconds = 0.0;
	double ActiveSeconds = 0.0;
	double BossEngagedAt = -1.0;
	double BossPhaseStartedAt = -1.0;
	int32 BossPhase = 1;
	TArray<double> BossPhaseSeconds;
	TArray<int32> ClearedServiceRooms;
	TMap<FString, int32> Kills;
	int32 Deaths = 0;
};
