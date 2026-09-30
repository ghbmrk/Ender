#include "Items/EnderFormTypes.h"

#include "Rules/LootRules.h"

#define LOCTEXT_NAMESPACE "EnderItems"

float FEnderForm::GetEvidenceMultiplier() const
{
	return static_cast<float>(EnderRules::EvidenceMultiplier(EnderConvert::ToRules(EvidenceTier)));
}

float FEnderForm::GetArtifactPower() const
{
	if (bOrdinary)
	{
		return OrdinaryPower;
	}
	return static_cast<float>(EnderRules::ArtifactPower(TechnicalScore, EnderConvert::ToRules(EvidenceTier)));
}

int32 FEnderForm::GetEssenceQuantity(EEnderEssence E) const
{
	for (const FEnderEssenceAmount& A : Recipe)
	{
		if (A.Essence == E)
		{
			return A.Quantity;
		}
	}
	return 0;
}

FText FEnderLootPayload::GetLabel() const
{
	switch (Kind)
	{
	case EEnderLootKind::Form:
		if (Form.bOrdinary)
		{
			return Form.FantasyName;
		}
		return Form.EvidenceTier == EEnderEvidenceTier::Veiled ? LOCTEXT("VeiledForm", "Veiled Form") : Form.FantasyName;
	case EEnderLootKind::Essence:
		return FText::Format(LOCTEXT("EssenceBundle", "{0} ×{1}"), EnderItems::EssenceName(Essence.Essence), FText::AsNumber(Essence.Quantity));
	case EEnderLootKind::Crowns:
		return FText::Format(LOCTEXT("Crowns", "{0} Crowns"), FText::AsNumber(Crowns));
	}
	return FText::GetEmpty();
}

namespace EnderItems
{
	static const TCHAR* GQualityKeys[] = {TEXT("burden"), TEXT("veil"), TEXT("reach"), TEXT("knots"), TEXT("flex"), TEXT("bond")};
	static const TCHAR* GEssenceKeys[] = {TEXT("ember"), TEXT("tide"), TEXT("storm"), TEXT("root"), TEXT("glass"), TEXT("ash")};
	static const TCHAR* GTierKeys[] = {TEXT("veiled"), TEXT("attuned"), TEXT("trialed"), TEXT("witnessed")};
	static const TCHAR* GSlotKeys[] = {TEXT("blade"), TEXT("ward"), TEXT("sigil"), TEXT("charm")};

	FString QualityKey(EEnderQuality Q) { return GQualityKeys[static_cast<int32>(Q)]; }
	FString EssenceKey(EEnderEssence E) { return GEssenceKeys[static_cast<int32>(E)]; }
	FString TierKey(EEnderEvidenceTier T) { return GTierKeys[static_cast<int32>(T)]; }
	FString SlotKey(EEnderGearSlot S) { return GSlotKeys[static_cast<int32>(S)]; }

	bool QualityFromKey(const FString& Key, EEnderQuality& Out)
	{
		for (int32 I = 0; I < static_cast<int32>(UE_ARRAY_COUNT(GQualityKeys)); ++I)
		{
			if (Key.Equals(GQualityKeys[I], ESearchCase::IgnoreCase))
			{
				Out = static_cast<EEnderQuality>(I);
				return true;
			}
		}
		return false;
	}

	bool EssenceFromKey(const FString& Key, EEnderEssence& Out)
	{
		for (int32 I = 0; I < static_cast<int32>(UE_ARRAY_COUNT(GEssenceKeys)); ++I)
		{
			if (Key.Equals(GEssenceKeys[I], ESearchCase::IgnoreCase))
			{
				Out = static_cast<EEnderEssence>(I);
				return true;
			}
		}
		return false;
	}

	bool TierFromKey(const FString& Key, EEnderEvidenceTier& Out)
	{
		for (int32 I = 0; I < static_cast<int32>(UE_ARRAY_COUNT(GTierKeys)); ++I)
		{
			if (Key.Equals(GTierKeys[I], ESearchCase::IgnoreCase))
			{
				Out = static_cast<EEnderEvidenceTier>(I);
				return true;
			}
		}
		return false;
	}

	FText QualityName(EEnderQuality Q)
	{
		switch (Q)
		{
		case EEnderQuality::Burden: return LOCTEXT("Burden", "Burden");
		case EEnderQuality::Veil: return LOCTEXT("Veil", "Veil");
		case EEnderQuality::Reach: return LOCTEXT("Reach", "Reach");
		case EEnderQuality::Knots: return LOCTEXT("Knots", "Knots");
		case EEnderQuality::Flex: return LOCTEXT("Flex", "Flex");
		case EEnderQuality::Bond: return LOCTEXT("Bond", "Bond");
		}
		return FText::GetEmpty();
	}

	FText EssenceName(EEnderEssence E)
	{
		switch (E)
		{
		case EEnderEssence::Ember: return LOCTEXT("Ember", "Ember");
		case EEnderEssence::Tide: return LOCTEXT("Tide", "Tide");
		case EEnderEssence::Storm: return LOCTEXT("Storm", "Storm");
		case EEnderEssence::Root: return LOCTEXT("Root", "Root");
		case EEnderEssence::Glass: return LOCTEXT("Glass", "Glass");
		case EEnderEssence::Ash: return LOCTEXT("Ash", "Ash");
		}
		return FText::GetEmpty();
	}

	FText TierName(EEnderEvidenceTier T)
	{
		switch (T)
		{
		case EEnderEvidenceTier::Veiled: return LOCTEXT("Veiled", "Veiled");
		case EEnderEvidenceTier::Attuned: return LOCTEXT("Attuned", "Attuned");
		case EEnderEvidenceTier::Trialed: return LOCTEXT("Trialed", "Trialed");
		case EEnderEvidenceTier::Witnessed: return LOCTEXT("Witnessed", "Witnessed");
		}
		return FText::GetEmpty();
	}

	EEnderLootRarity RarityForPower(float Power)
	{
		if (Power >= 80.f) return EEnderLootRarity::HighValue;
		if (Power >= 60.f) return EEnderLootRarity::Exceptional;
		if (Power >= 40.f) return EEnderLootRarity::Rare;
		return EEnderLootRarity::Common;
	}
}

#undef LOCTEXT_NAMESPACE
