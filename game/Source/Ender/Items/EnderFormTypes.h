#pragma once

#include "CoreMinimal.h"
#include "Core/EnderTypes.h"
#include "EnderFormTypes.generated.h"

/*
 * Runtime item data. Player-facing fields use fantasy vocabulary only (Forms,
 * qualities, Essences, Power). The scientific record behind a Form lives in
 * FEnderFormProvenance, which is filled only when the developer provenance
 * setting is on (UEnderRealitySettings::bRequestDeveloperProvenance).
 */

constexpr int32 EnderNumQualities = 6;
constexpr int32 EnderNumEssences = 6;

USTRUCT(BlueprintType)
struct ENDER_API FEnderEssenceAmount
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ender|Essence") EEnderEssence Essence = EEnderEssence::Ember;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ender|Essence") int32 Quantity = 0;
};

/** Developer-only record behind a Form. Never shown in player UI. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderFormProvenance
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") bool bValid = false;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") FString Source;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") FString Cid;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") FString Title;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") FString MolecularFormula;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") float MolecularWeight = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") float XLogP = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") float TPSA = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") float Complexity = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") int32 HBondDonorCount = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") int32 HBondAcceptorCount = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") int32 RotatableBondCount = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") FString SourceUrl;
};

/** One Form of the Realm's prefetched pool: what a Veiled drop can turn out to be. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderCandidate
{
	GENERATED_BODY()

	/** Fantasy id ("form-…"), the only id the client shows or sends. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") FString Id;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") FText Name;
	/** Burden, Veil, Reach, Knots, Flex, Bond; 0–100. */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") TArray<float> Qualities;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") TArray<FEnderEssenceAmount> Recipe;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") float ProductionCost = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") float TechnicalScore = 0.f;
	/** Rank of TechnicalScore within this Realm's pool, 0–100 (computed client-side after prefetch). */
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Form") float TechnicalPercentile = 50.f;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") FEnderFormProvenance DevProvenance;

	float GetQuality(EEnderQuality Q) const
	{
		const int32 I = static_cast<int32>(Q);
		return Qualities.IsValidIndex(I) ? Qualities[I] : 0.f;
	}
};

/** A Form the player holds (or an ordinary item when the reality layer is offline). */
USTRUCT(BlueprintType)
struct ENDER_API FEnderForm
{
	GENERATED_BODY()

	/** Local item id, stable across saves. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") FGuid Id;
	/** Service artifact id once the run banked it (checkpoint/complete); empty before. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") FString ArtifactId;
	/** Fantasy candidate id ("form-…"); empty for ordinary items. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") FString CandidateId;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") FString RealmId;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") FText FantasyName;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") FText Epithet;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") TArray<float> Qualities;
	/** Bit i set = quality i (EEnderQuality order) is revealed to the player. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") int32 RevealedQualityMask = 0;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") EEnderEvidenceTier EvidenceTier = EEnderEvidenceTier::Veiled;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") float TechnicalScore = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") float ProductionCost = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") float EstimatedMarketValue = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") float EfficiencyScore = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") float MarginPotential = 0.f;
	/** True once the service evaluated it (Trial or better); estimates before that. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") bool bEvaluated = false;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") TArray<FEnderEssenceAmount> Recipe;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") int32 Revision = 0;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") EEnderDropSource DropSource = EEnderDropSource::Room1;
	/** Familiar interpretation from the last Attune/Critique, at most two lines. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") TArray<FText> FamiliarLines;

	/** Offline fallback item: fixed power, no qualities, no reality data. */
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") bool bOrdinary = false;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") float OrdinaryPower = 0.f;
	UPROPERTY(BlueprintReadOnly, SaveGame, Category = "Ender|Form") EEnderGearSlot OrdinarySlot = EEnderGearSlot::Blade;

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Dev") FEnderFormProvenance DevProvenance;

	bool IsValid() const { return Id.IsValid(); }
	bool IsQualityRevealed(EEnderQuality Q) const { return (RevealedQualityMask & (1 << static_cast<int32>(Q))) != 0; }
	void RevealQuality(EEnderQuality Q) { RevealedQualityMask |= 1 << static_cast<int32>(Q); }
	void RevealAll() { RevealedQualityMask = (1 << EnderNumQualities) - 1; }

	float GetQuality(EEnderQuality Q) const
	{
		const int32 I = static_cast<int32>(Q);
		return Qualities.IsValidIndex(I) ? Qualities[I] : 0.f;
	}

	/** artifactPower = technical × evidence multiplier (.70/.85/1.00/1.10), clamped 0–110. */
	float GetArtifactPower() const;
	float GetEvidenceMultiplier() const;
	int32 GetEssenceQuantity(EEnderEssence E) const;
};

/** Loot on the ground: a Form, an Essence bundle or Crowns. */
UENUM(BlueprintType)
enum class EEnderLootKind : uint8
{
	Form,
	Essence,
	Crowns,
};

/** Loot label colour class (Rare #597DA2, Exceptional #8667A3, High Value #C09A50). */
UENUM(BlueprintType)
enum class EEnderLootRarity : uint8
{
	Common,
	Rare,
	Exceptional,
	HighValue,
};

USTRUCT(BlueprintType)
struct ENDER_API FEnderLootPayload
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Ender|Loot") EEnderLootKind Kind = EEnderLootKind::Essence;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Loot") FEnderForm Form;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Loot") FEnderEssenceAmount Essence;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Loot") int32 Crowns = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Ender|Loot") EEnderLootRarity Rarity = EEnderLootRarity::Common;

	/** Stencil 6 (valuable loot) for Forms; stencil 5 (interactable) otherwise. */
	bool IsValuable() const { return Kind == EEnderLootKind::Form; }
	FText GetLabel() const;
};

namespace EnderItems
{
	ENDER_API FString QualityKey(EEnderQuality Q);
	ENDER_API bool QualityFromKey(const FString& Key, EEnderQuality& Out);
	ENDER_API FString EssenceKey(EEnderEssence E);
	ENDER_API bool EssenceFromKey(const FString& Key, EEnderEssence& Out);
	ENDER_API FString TierKey(EEnderEvidenceTier T);
	ENDER_API bool TierFromKey(const FString& Key, EEnderEvidenceTier& Out);
	ENDER_API FString SlotKey(EEnderGearSlot S);
	/** Player-facing quality / Essence names. */
	ENDER_API FText QualityName(EEnderQuality Q);
	ENDER_API FText EssenceName(EEnderEssence E);
	ENDER_API FText TierName(EEnderEvidenceTier T);
	/** Rarity from Power: ≥80 High Value, ≥60 Exceptional, ≥40 Rare. */
	ENDER_API EEnderLootRarity RarityForPower(float Power);
}
