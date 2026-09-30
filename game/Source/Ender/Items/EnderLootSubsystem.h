#pragma once

#include "CoreMinimal.h"
#include "Core/EnderTypes.h"
#include "Items/EnderFormTypes.h"
#include "Reality/EnderRealityTypes.h"
#include "Rules/LootRules.h"
#include "Subsystems/WorldSubsystem.h"
#include "EnderLootSubsystem.generated.h"

class AEnderLootDrop;
class UEnderLootProfile;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnLootDropped, AEnderLootDrop*, Drop);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnLootLabelsChanged, bool, bVisible);

/**
 * Every loot decision in a Realm, drawn from the run's Loot stream so a seed
 * replays exactly:
 *   · Essence bundle about once per 5–8 normal kills (FEssenceDropCounter)
 *   · Veiled Forms on room clear: Room 2 35% (guaranteed in the tutorial),
 *     Room 3 50%, Room 4 65%, Elite 100%, Boss exactly 2 (Loot::VeiledFormsFor)
 *   · which Form: ChooseCandidate over the prefetched pool, biased by the kills
 *     that earned it (Husk→Burden, Hound→Flex, Wisp→Reach, Keeper→Knots,
 *     Seer→Veil/Bond), pushed up by the Charm and, for elites and the boss, by
 *     Discovery Mastery (≤ +15 percentile points)
 * With the reality layer offline, Forms become ordinary items (OrdinaryLoot).
 */
UCLASS()
class ENDER_API UEnderLootSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	static UEnderLootSubsystem* Get(const UObject* WorldContext);

	/** Resets the Essence cadence and bias, caches the Form pool. Called by UEnderRealmSubsystem::StartRealm. */
	void BeginRealm(const FEnderRealmPrefetch& Prefetch, UEnderLootProfile* InProfile);

	/** A room fight begins: the room's bias tally starts empty. */
	void BeginRoom();

	/** Every Hushed kill. Normal kills advance the Essence cadence; all kills feed the Form bias. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Loot")
	void NotifyEnemyKilled(EEnderArchetype Archetype, bool bElite, FVector Location);

	/** Room clear rewards (Veiled Forms per room kind, Crowns). ServiceRoomIndex links drops to the run checkpoint. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Loot")
	void DropRoomRewards(EEnderRoomKind Room, FVector Location, bool bTutorial, int32 ServiceRoomIndex);

	/** Exactly two Forms plus Crowns. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Loot")
	void DropBossRewards(FVector Location, int32 ServiceRoomIndex = 7);

	/** Rolls one Form (or ordinary item) without spawning it. */
	FEnderForm RollForm(EEnderDropSource Source, bool bEliteRoll, const EnderRules::FFormBias& Bias);

	AEnderLootDrop* SpawnDrop(const FEnderLootPayload& Payload, const FVector& Location);

	/** Alt held → labels on every drop. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Loot") void SetLabelsVisible(bool bVisible);
	UFUNCTION(BlueprintPure, Category = "Ender|Loot") bool AreLabelsVisible() const { return bLabelsVisible; }

	void RegisterDrop(AEnderLootDrop* Drop);
	void UnregisterDrop(AEnderLootDrop* Drop);

	UPROPERTY(BlueprintAssignable, Category = "Ender|Loot") FEnderOnLootDropped OnLootDropped;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Loot") FEnderOnLootLabelsChanged OnLootLabelsChanged;

private:
	EnderRules::FRunRandom& LootRng();
	float CharmBonus() const;
	FVector Scatter(const FVector& Around) const;
	FText OrdinaryName(EEnderGearSlot Slot) const;
	void DropForms(int32 Count, EEnderDropSource Source, bool bEliteRoll, const EnderRules::FFormBias& Bias, const FVector& Location, int32 ServiceRoomIndex);

	UPROPERTY() TObjectPtr<UEnderLootProfile> Profile;
	FEnderRealmPrefetch Realm;
	std::vector<EnderRules::FCandidateView> PoolViews;
	EnderRules::FEssenceDropCounter EssenceCounter;
	EnderRules::FFormBias RoomBias;
	EnderRules::FFormBias RealmBias;
	EnderRules::FRunRandom FallbackRng{0x10075ull};
	TArray<TWeakObjectPtr<AEnderLootDrop>> Drops;
	bool bLabelsVisible = false;
};
