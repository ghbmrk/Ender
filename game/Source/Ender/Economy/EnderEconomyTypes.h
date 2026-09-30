#pragma once

#include "CoreMinimal.h"
#include "Core/EnderTypes.h"
#include "Items/EnderFormTypes.h"
#include "EnderEconomyTypes.generated.h"

/*
 * Display data the reality service computes (prices, scarcity, contracts, XP,
 * Mastery, passives). The client parses it into these structs and shows it; it
 * never recomputes an economic value. Player-facing words are fantasy words:
 * scarcity is "very abundant … very scarce", demand is a "bounty".
 */

UENUM(BlueprintType)
enum class EEnderContractIssuer : uint8
{
	Noble,
	Royal,
	Smith,
	Scholar,
};

UENUM(BlueprintType)
enum class EEnderPassiveBranch : uint8
{
	Sight,
	Wildcraft,
	Forge,
	Ruin,
	Efficiency,
	Ledger,
};

UENUM(BlueprintType)
enum class EEnderMasteryDomain : uint8
{
	Discovery,
	Craft,
	Proof,
	Prophecy,
	Efficiency,
	Commerce,
};

namespace EnderEconomy
{
	constexpr int32 LevelCap = 30;
}

USTRUCT(BlueprintType)
struct ENDER_API FEnderEssenceMarket
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") EEnderEssence Essence = EEnderEssence::Ember;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") FText Name;
	/** 0–100. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") float Scarcity = 50.f;
	/** "very abundant" | "abundant" | "steady" | "scarce" | "very scarce". */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") FText ScarcityWord;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") float Price = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") float BuyPrice = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") float SellPrice = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") int32 Held = 0;
	/** Bazaar trend line, e.g. "Storm has grown dear over five turnings." */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") FText Trend;
	/** dear | rising | steady | cheap */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") FString Status;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") TArray<float> History;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") FLinearColor Color = FLinearColor::White;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderWorldState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") bool bValid = false;
	/** Replay date of the current world turning (YYYY-MM-DD). */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") FString Date;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") FString SnapshotId;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") int32 Index = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") int32 Total = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") TArray<FEnderEssenceMarket> Essences;
	/** Caravan blights and gluts, already worded for players. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|World") TArray<FText> Modifiers;

	const FEnderEssenceMarket* Find(EEnderEssence E) const { return Essences.FindByPredicate([E](const FEnderEssenceMarket& M) { return M.Essence == E; }); }
	float GetScarcity(EEnderEssence E) const { const FEnderEssenceMarket* M = Find(E); return M ? M->Scarcity : 50.f; }
	float GetPrice(EEnderEssence E) const { const FEnderEssenceMarket* M = Find(E); return M ? M->Price : 0.f; }
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderContract
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") FString Id;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") EEnderContractIssuer Issuer = EEnderContractIssuer::Noble;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") FText Title;
	/** e.g. "Deliver a Form with Power > 60 and zero Storm". */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") FText Description;
	/** Short pin label, e.g. "Royal Demand: Storm-free Forms +38% bounty". Two lines at most on the HUD. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") FText Label;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") FText Reason;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") int32 Reward = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") bool bHasTargetEssence = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") EEnderEssence TargetEssence = EEnderEssence::Ember;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") float MinPower = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") TArray<FEnderEssenceAmount> MaxEssence;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") bool bHasMinTier = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") EEnderEvidenceTier MinTier = EEnderEvidenceTier::Trialed;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") int32 TurningsLeft = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") TArray<FString> EligibleArtifactIds;
	/** fulfilled | open | expired */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Contract") FString Status;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderQualityReading
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") EEnderQuality Quality = EEnderQuality::Burden;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") float Value = 0.f;
};

/** A Veiled Form the Bazaar sells, with the two qualities it shows. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderBazaarOffer
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") FString Id;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") FString RealmId;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") FText RealmName;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") float Price = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") FString Status;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") TArray<FEnderQualityReading> Revealed;
	/** Set only with the Ledger passive that reveals a mispriced Form. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") FText Hint;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderProphecy
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Prophecy") FString Id;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Prophecy") EEnderEssence Essence = EEnderEssence::Ember;
	/** One of 0.1, 0.3, 0.5, 0.7, 0.9: "the Essence grows scarcer next turning". */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Prophecy") float Probability = 0.5f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Prophecy") FString Status;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Prophecy") bool bResolved = false;
	/** 1 − (p − outcome)², shown as a clarity score. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Prophecy") float Quality = 0.f;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderBazaarState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") bool bValid = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") FText Headline;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") float Spread = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") TArray<FEnderEssenceMarket> Essences;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") TArray<FEnderBazaarOffer> Offers;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") TArray<FEnderContract> Contracts;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") TArray<FEnderProphecy> Prophecies;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") TArray<FText> Rumors;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Bazaar") TArray<FText> WorldEvents;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderExpectedEssence
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") EEnderEssence Essence = EEnderEssence::Ember;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FText Name;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") float Share = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FText ScarcityWord;
	/** A caravan glut: this Realm yields more of it this turning. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") bool bGlut = false;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderScarcityIndicator
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") EEnderEssence Essence = EEnderEssence::Ember;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") int32 Level = 50;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FText Word;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderContractRelevance
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FString ContractId;
	/** e.g. "Royal Demand: Storm-free Forms +38% bounty". */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FText Label;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") EEnderContractIssuer Issuer = EEnderContractIssuer::Noble;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") bool bHasBounty = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") int32 BountyPct = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") int32 Reward = 0;
	/** "↑↑", "↑", "" — how well this Realm's Forms tend to fit. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FString Arrows;
};

/** The Realm Gate card: everything shown before choosing a Realm. No financial words. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderRealmGateCard
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") bool bValid = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FString RealmId;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FText Name;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FText Tagline;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") int32 Difficulty = 1;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") FText DifficultyLabel;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") TArray<FEnderExpectedEssence> ExpectedEssences;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") TArray<FEnderScarcityIndicator> Scarcity;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") TArray<FEnderContractRelevance> Contracts;
	/** e.g. "Light Forms", "Many Knots". */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") TArray<FText> FormBias;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") int32 HaulCrowns = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Realm") TArray<FText> Events;

	/** Strongest positive bounty on this card, used to tag economy-driven Realm choices. */
	int32 BestBountyPct() const
	{
		int32 Best = 0;
		for (const FEnderContractRelevance& C : Contracts) Best = C.bHasBounty ? FMath::Max(Best, C.BountyPct) : Best;
		return Best;
	}
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderSearchPolicy
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Policy") float Exploration = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Policy") float Optimization = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Policy") float Critique = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Policy") float Evidence = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Policy") float Efficiency = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Policy") float Arbitrage = 0.f;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderPassiveNode
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") FString Id;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") EEnderPassiveBranch Branch = EEnderPassiveBranch::Sight;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") FText Name;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") int32 Depth = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") FString Requires;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") FText Description;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") bool bAllocated = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") bool bAvailable = false;
};

/** Six branches (Sight, Wildcraft, Forge, Ruin, Efficiency, Ledger), about 24 nodes. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderPassiveTree
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") bool bValid = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") TArray<FEnderPassiveNode> Nodes;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") int32 PointsAvailable = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Passives") FEnderSearchPolicy Policy;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderMasteryEntry
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") EEnderMasteryDomain Domain = EEnderMasteryDomain::Discovery;
	/** 0–100 as the service displays it. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") float Display = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") float Successes = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") float Failures = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") int32 Opportunities = 0;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderMasterySnapshot
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") TArray<FEnderMasteryEntry> Domains;
	/** Elite Form drop percentile bonus from Discovery Mastery, max +15. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") float DiscoveryPercentile = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") float ProofWardMultiplier = 1.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Mastery") float FocusConversion = 2.f;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderCharacterProgress
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") bool bValid = false;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") FString CharacterId;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") FString Name;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") int32 Level = 1;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") int32 Xp = 0;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") int32 XpForLevel = 0;
	/** 0 at the level cap (30). */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") int32 XpForNext = 0;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") int32 Crowns = 0;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") int32 Focus = 12;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") int32 MaxFocus = 12;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") int32 PassivePointsAvailable = 0;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") TArray<FString> Passives;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") FEnderSearchPolicy EffectivePolicy;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") FEnderMasterySnapshot Mastery;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") TArray<FEnderEssenceAmount> Essences;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") FString WorldDate;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Character") float LootPercentileBonus = 0.f;

	float LevelProgress() const
	{
		if (Level >= EnderEconomy::LevelCap || XpForNext <= XpForLevel) return 1.f;
		return FMath::Clamp(static_cast<float>(Xp - XpForLevel) / static_cast<float>(XpForNext - XpForLevel), 0.f, 1.f);
	}
};

/** One Temper option offered by the Familiar. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderTemperChoice
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Crucible") FString CandidateId;
	/** improve | explore | repair | economize | profit | evidence */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Crucible") FString Emphasis;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Crucible") FText Rationale;
};

/** A Familiar critique (Fracture / Mirror / Deep Trial). */
USTRUCT(BlueprintType)
struct ENDER_API FEnderCritique
{
	GENERATED_BODY()

	/** sound | fragile | flawed */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Crucible") FString Verdict;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Crucible") FText Weakness;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Crucible") FText SecondWeakness;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Crucible") FText Summary;
};

/** Service-side cost/provenance of an inference call (envelope usage + provenance). */
USTRUCT(BlueprintType)
struct ENDER_API FEnderInferenceUsage
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Reality") int32 WorkUnits = 0;
	/** fixture | rule */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Reality") FString Provider;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Reality") FString RequestHash;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Reality") int32 XpAwarded = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Reality") int32 FocusSpent = 0;
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderGrimoireEntry
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Grimoire") FEnderForm Form;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Grimoire") FString ParentArtifactId;
	/** temper | drop | bazaar … */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Grimoire") FString Origin;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Grimoire") FString Status;
};

namespace EnderEconomy
{
	/** The five Prophecy options: 10/30/50/70/90%. */
	constexpr float ProphecyOptions[5] = {0.1f, 0.3f, 0.5f, 0.7f, 0.9f};

	ENDER_API bool IssuerFromKey(const FString& Key, EEnderContractIssuer& Out);
	ENDER_API bool BranchFromKey(const FString& Key, EEnderPassiveBranch& Out);
	ENDER_API FString MasteryKey(EEnderMasteryDomain D);
	ENDER_API FText MasteryName(EEnderMasteryDomain D);
	ENDER_API FText BranchName(EEnderPassiveBranch B);
	/** Same thresholds as the service's scarcityWord(). */
	ENDER_API FText ScarcityWord(float Scarcity);
}
