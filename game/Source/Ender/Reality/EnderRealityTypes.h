#pragma once

#include "CoreMinimal.h"
#include "Economy/EnderEconomyTypes.h"
#include "Items/EnderFormTypes.h"
#include "EnderRealityTypes.generated.h"

USTRUCT(BlueprintType)
struct ENDER_API FEnderRunPlanRoom
{
	GENERATED_BODY()

	/** Service room index: 0–4 combat, 5 shrine, 6 elite, 7 boss. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") int32 Index = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") FString Kind;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") int32 Crowns = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") int32 VeiledForms = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") TArray<FEnderEssenceAmount> Essences;
};

/** POST /api/runs → plan (the client-safe view: Form identities are not included). */
USTRUCT(BlueprintType)
struct ENDER_API FEnderRunPlan
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") bool bValid = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") FString RunId;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") FString RealmId;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") FString SnapshotId;
	/** The service's seed string; RunSeed is its FNV-1a hash. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") FString SeedString;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") int32 Difficulty = 1;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") TArray<FEnderRunPlanRoom> Rooms;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") FText BossName;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") int32 BossHealth = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") int32 Focus = 12;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Run") float LootPercentileBonus = 0.f;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderEssenceWeight
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") EEnderEssence Essence = EEnderEssence::Ember;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") float Weight = 1.f;
};

/**
 * Everything a Realm needs, fetched before the Realm level loads. Combat never
 * waits on the network: loot rolls read CandidatePool, prices and contracts come
 * from here, and the run seed seeds UEnderRunRandomSubsystem.
 */
USTRUCT(BlueprintType)
struct ENDER_API FEnderRealmPrefetch
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") bool bValid = false;
	/** Reality layer unavailable: Forms become ordinary loot, nothing is sent to the service. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") bool bOffline = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FString RealmId;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FEnderRealmGateCard Card;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FEnderWorldState World;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") TArray<FEnderContract> Contracts;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") TArray<FEnderCandidate> CandidatePool;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") TArray<FEnderEssenceWeight> EssenceDrops;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FEnderRunPlan Run;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") int64 RunSeed = 0;
	/** Discovery Mastery elite percentile (≤ +15), from the character's mastery. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") float DiscoveryPercentileBonus = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") int32 Focus = 12;
	/** Marks the first Realm of a new character: Room 2's Veiled Form is guaranteed. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") bool bTutorial = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FDateTime PrefetchedAt;

	const FEnderCandidate* FindCandidate(const FString& Id) const
	{
		return CandidatePool.FindByPredicate([&Id](const FEnderCandidate& C) { return C.Id == Id; });
	}
};

/** A request held back while a Realm is active, replayed when the Realm ends. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderDeferredRequest
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Reality") FString Verb;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Reality") FString Path;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Reality") FString Body;
	/** Local Form this concerns; its ArtifactId is substituted for "{artifact}" in Path/Body at replay. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Reality") FGuid FormId;
};
