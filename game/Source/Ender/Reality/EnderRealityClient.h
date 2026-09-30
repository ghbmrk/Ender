#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"
#include "Interfaces/IHttpRequest.h"
#include "Reality/EnderRealityTypes.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "EnderRealityClient.generated.h"

struct FEnderPrefetchJob;

DECLARE_DELEGATE_ThreeParams(FEnderRealityJsonCallback, bool /*bOk*/, int32 /*HttpStatus*/, const TSharedPtr<FJsonObject>& /*Json*/);
DECLARE_DELEGATE_TwoParams(FEnderOnWorldLoadedNative, bool /*bOk*/, const FEnderWorldState&);
DECLARE_DELEGATE_TwoParams(FEnderOnPrefetchNative, bool /*bOnline*/, const FEnderRealmPrefetch&);
DECLARE_DELEGATE_TwoParams(FEnderOnCandidateNative, bool /*bOk*/, const FEnderCandidate&);
DECLARE_DELEGATE_TwoParams(FEnderOnActionNative, bool /*bOk*/, const FString& /*Message*/);
DECLARE_MULTICAST_DELEGATE_OneParam(FEnderOnArtifactsBankedNative, const TArray<FEnderForm>& /*ServiceArtifacts*/);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnWorldStateUpdated, const FEnderWorldState&, World);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnRealmCardLoaded, const FEnderRealmGateCard&, Card);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnRealmPrefetched, bool, bOnline, const FEnderRealmPrefetch&, Prefetch);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnBazaarUpdated, const FEnderBazaarState&, Bazaar);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnContractsUpdated, const TArray<FEnderContract>&, Contracts);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnCharacterUpdated, const FEnderCharacterProgress&, Character);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnPassivesUpdated, const FEnderPassiveTree&, Passives);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FEnderOnArtifactUpdated, const FEnderForm&, Artifact, const TArray<FText>&, FamiliarLines, const FEnderInferenceUsage&, Usage);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FEnderOnTemperOptions, const FString&, ArtifactId, const TArray<FEnderTemperChoice>&, Choices, const FText&, Summary);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnCritique, const FString&, ArtifactId, const FEnderCritique&, Critique);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnGrimoireLoaded, const TArray<FEnderGrimoireEntry>&, Entries);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FEnderOnServiceAction, const FString&, Action, bool, bOk, const FString&, Message);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnServiceStatus, bool, bReachable);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnRequestRefused, const FString&, Path);

/**
 * The only door between the game and the reality layer. It speaks HTTP to the
 * local reality service (reality-service/, UEnderRealitySettings::ServiceBaseUrl)
 * and never to a scientific or market provider.
 *
 * Combat rule: nothing in a Realm waits on the network. PrefetchRealm gathers the
 * Form pool, prices, contracts and run seed before the Realm level loads. While a
 * Realm is active every request is refused (logged, OnRequestRefused) except run
 * checkpoints, which are queued and sent fire-and-forget from FlushRunCheckpoints
 * at room clear and at the Reward Altar, never while IsInCombat(). Crafting done
 * at the Attunement Shrine is recorded locally and replayed after the Realm
 * (QueueDeferred / ReplayDeferred).
 */
UCLASS()
class ENDER_API UEnderRealityClient : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	static UEnderRealityClient* Get(const UObject* WorldContext);

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// ------------------------------------------------------------ state gates

	/** Set by UEnderRealmSubsystem at Realm start/end. */
	void SetRealmActive(bool bActive);
	UFUNCTION(BlueprintPure, Category = "Ender|Reality") bool IsRealmActive() const { return bRealmActive; }

	/** Set by encounter directors while a room fight or the boss is live. */
	void SetInCombat(bool bInCombat);
	UFUNCTION(BlueprintPure, Category = "Ender|Reality") bool IsInCombat() const { return bInCombat; }

	UFUNCTION(BlueprintPure, Category = "Ender|Reality") bool IsServiceReachable() const { return bServiceReachable; }
	/** True when the current Realm plays without the reality layer (ordinary loot). */
	UFUNCTION(BlueprintPure, Category = "Ender|Reality") bool IsOffline() const { return ActivePrefetch.bOffline; }

	// ------------------------------------------------------------ prefetch

	/** Gathers everything the Realm needs; falls back to an offline prefetch when allowed. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void PrefetchRealm(const FString& RealmId, bool bTutorial);
	void PrefetchRealmNative(const FString& RealmId, bool bTutorial, FEnderOnPrefetchNative OnDone);

	/** Offline Realm data: run seed only, no Form pool. Used by the fallback path and in PIE without a service. */
	FEnderRealmPrefetch MakeOfflinePrefetch(const FString& RealmId, bool bTutorial) const;

	UFUNCTION(BlueprintPure, Category = "Ender|Reality") bool HasPrefetch() const { return ActivePrefetch.bValid; }
	UFUNCTION(BlueprintPure, Category = "Ender|Reality") FEnderRealmPrefetch GetPrefetchCopy() const { return ActivePrefetch; }
	const FEnderRealmPrefetch& GetPrefetch() const { return ActivePrefetch; }
	void SetPrefetch(const FEnderRealmPrefetch& Prefetch) { ActivePrefetch = Prefetch; }
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void ClearPrefetch();

	// ------------------------------------------------------------ run

	/** Records which pool Forms dropped in a service room, so the checkpoint can bank the same Forms. */
	void RecordFormDrop(int32 ServiceRoomIndex, const FString& CandidateId);
	void QueueRunCheckpoint(int32 ServiceRoomIndex);
	/** Sends queued checkpoints now (room clear / Reward Altar). Never waits; refused while in combat. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void FlushRunCheckpoints();
	/** After the Realm ends: outcome is victory | death | abandon. */
	void CompleteRun(const FString& Outcome, const TArray<int32>& RoomsCleared, const TMap<FString, int32>& Kills, double DurationSeconds,
		int32 Deaths, const TArray<double>& BossPhaseSeconds);

	/** Service artifacts created by checkpoint/complete; the inventory links them to local Forms by candidate id. */
	FEnderOnArtifactsBankedNative OnArtifactsBanked;

	/** Holds a request until the Realm ends. "{artifact}" in Path/Body becomes the Form's service artifact id. */
	void QueueDeferred(const FString& Verb, const FString& Path, const FString& Body, const FGuid& FormId);
	void ReplayDeferred(TFunctionRef<FString(const FGuid&)> ResolveArtifactId);
	const TArray<FEnderDeferredRequest>& GetDeferred() const { return Deferred; }
	void RestoreDeferred(const TArray<FEnderDeferredRequest>& InDeferred) { Deferred = InDeferred; }

	// ------------------------------------------------------------ reads

	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void RequestWorld();
	void FetchWorld(FEnderOnWorldLoadedNative OnDone);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void RequestRealmCard(const FString& RealmId);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void RequestBazaar();
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void RequestContracts();
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void RequestCharacter();
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void RequestPassives();
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void RequestGrimoire();
	void FetchCandidate(const FString& CandidateId, const FString& RealmId, FEnderOnCandidateNative OnDone);

	// ------------------------------------------------------------ actions (outside Realms)

	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void Attune(const FString& ArtifactId);
	/** Mode: trial | mirror | deep-trial. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void Evaluate(const FString& ArtifactId, const FString& Mode);
	/** Mode: fracture | mirror | deep. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void Critique(const FString& ArtifactId, const FString& Mode);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void RequestTemperOptions(const FString& ArtifactId);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void ChooseTemper(const FString& ArtifactId, const FString& CandidateId);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void Equip(EEnderGearSlot Slot, const FString& ArtifactId);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void AllocatePassive(const FString& NodeId);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void BuyEssence(EEnderEssence Essence, int32 Quantity);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void SellEssence(EEnderEssence Essence, int32 Quantity);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void BuyVeiledForm(const FString& OfferId);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void SellForm(const FString& ArtifactId, bool bSalvage);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void FulfilContract(const FString& ContractId, const FString& ArtifactId);
	/** OptionIndex 0–4 → 10/30/50/70/90%. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void MakeProphecy(EEnderEssence Essence, int32 OptionIndex);
	UFUNCTION(BlueprintCallable, Category = "Ender|Reality") void ResolveProphecy(const FString& ProphecyId);

	/** Generic access for systems not covered above. Subject to the same Realm gate. */
	void SendRequest(const FString& Verb, const FString& Path, const TSharedPtr<FJsonObject>& Body, FEnderRealityJsonCallback OnDone);

	// ------------------------------------------------------------ events

	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnWorldStateUpdated OnWorldStateUpdated;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnRealmCardLoaded OnRealmCardLoaded;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnRealmPrefetched OnRealmPrefetched;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnBazaarUpdated OnBazaarUpdated;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnContractsUpdated OnContractsUpdated;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnCharacterUpdated OnCharacterUpdated;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnPassivesUpdated OnPassivesUpdated;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnArtifactUpdated OnArtifactUpdated;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnTemperOptions OnTemperOptions;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnCritique OnCritique;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnGrimoireLoaded OnGrimoireLoaded;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnServiceAction OnServiceAction;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnServiceStatus OnServiceStatusChanged;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Reality") FEnderOnRequestRefused OnRequestRefused;

	UFUNCTION(BlueprintPure, Category = "Ender|Reality") FEnderWorldState GetWorldState() const { return World; }
	UFUNCTION(BlueprintPure, Category = "Ender|Reality") FEnderCharacterProgress GetCharacter() const { return Character; }
	UFUNCTION(BlueprintPure, Category = "Ender|Reality") TArray<FEnderContract> GetContracts() const { return Contracts; }

private:
	bool GateRequest(const FString& Path, bool bRunCheckpoint);
	void Dispatch(const FString& Verb, const FString& Path, const FString& Body, FEnderRealityJsonCallback OnDone);
	void SetServiceReachable(bool bReachable);
	void PostAction(const FString& Action, const FString& Path, const TSharedPtr<FJsonObject>& Body, bool bRefreshBazaar);
	void HandleArtifactEnvelope(const FString& ArtifactId, const TSharedPtr<FJsonObject>& Json);
	void BroadcastBanked(const TSharedPtr<FJsonObject>& Json, const TCHAR* ArrayField);
	FString CandidateQuery(const FString& RealmId) const;

	void BeginPrefetchReads(const TSharedRef<FEnderPrefetchJob>& Job);
	void PrefetchReadDone(const TSharedRef<FEnderPrefetchJob>& Job);
	void FinishPrefetch(const TSharedRef<FEnderPrefetchJob>& Job, bool bOnline);

	bool bRealmActive = false;
	bool bInCombat = false;
	bool bServiceReachable = true;
	bool bPrefetchInFlight = false;

	FEnderRealmPrefetch ActivePrefetch;
	FEnderWorldState World;
	FEnderCharacterProgress Character;
	TArray<FEnderContract> Contracts;

	TSet<int32> ClearedServiceRooms;
	TSet<int32> PendingCheckpointRooms;
	TMap<int32, TArray<FString>> FormDropsByRoom;
	TArray<FEnderDeferredRequest> Deferred;
};
