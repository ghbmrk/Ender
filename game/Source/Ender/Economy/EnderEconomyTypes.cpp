#include "Economy/EnderEconomyTypes.h"

#define LOCTEXT_NAMESPACE "EnderEconomy"

namespace EnderEconomy
{
	bool IssuerFromKey(const FString& Key, EEnderContractIssuer& Out)
	{
		if (Key == TEXT("noble")) { Out = EEnderContractIssuer::Noble; return true; }
		if (Key == TEXT("royal")) { Out = EEnderContractIssuer::Royal; return true; }
		if (Key == TEXT("smith")) { Out = EEnderContractIssuer::Smith; return true; }
		if (Key == TEXT("scholar")) { Out = EEnderContractIssuer::Scholar; return true; }
		return false;
	}

	bool BranchFromKey(const FString& Key, EEnderPassiveBranch& Out)
	{
		static const TCHAR* Keys[] = {TEXT("sight"), TEXT("wildcraft"), TEXT("forge"), TEXT("ruin"), TEXT("efficiency"), TEXT("ledger")};
		for (int32 I = 0; I < static_cast<int32>(UE_ARRAY_COUNT(Keys)); ++I)
		{
			if (Key.Equals(Keys[I], ESearchCase::IgnoreCase))
			{
				Out = static_cast<EEnderPassiveBranch>(I);
				return true;
			}
		}
		return false;
	}

	FString MasteryKey(EEnderMasteryDomain D)
	{
		static const TCHAR* Keys[] = {TEXT("discovery"), TEXT("craft"), TEXT("proof"), TEXT("prophecy"), TEXT("efficiency"), TEXT("commerce")};
		return Keys[static_cast<int32>(D)];
	}

	FText MasteryName(EEnderMasteryDomain D)
	{
		switch (D)
		{
		case EEnderMasteryDomain::Discovery: return LOCTEXT("Discovery", "Discovery");
		case EEnderMasteryDomain::Craft: return LOCTEXT("Craft", "Craft");
		case EEnderMasteryDomain::Proof: return LOCTEXT("Proof", "Proof");
		case EEnderMasteryDomain::Prophecy: return LOCTEXT("Prophecy", "Prophecy");
		case EEnderMasteryDomain::Efficiency: return LOCTEXT("Efficiency", "Efficiency");
		case EEnderMasteryDomain::Commerce: return LOCTEXT("Commerce", "Commerce");
		}
		return FText::GetEmpty();
	}

	FText BranchName(EEnderPassiveBranch B)
	{
		switch (B)
		{
		case EEnderPassiveBranch::Sight: return LOCTEXT("Sight", "Sight");
		case EEnderPassiveBranch::Wildcraft: return LOCTEXT("Wildcraft", "Wildcraft");
		case EEnderPassiveBranch::Forge: return LOCTEXT("Forge", "Forge");
		case EEnderPassiveBranch::Ruin: return LOCTEXT("Ruin", "Ruin");
		case EEnderPassiveBranch::Efficiency: return LOCTEXT("BranchEfficiency", "Efficiency");
		case EEnderPassiveBranch::Ledger: return LOCTEXT("Ledger", "Ledger");
		}
		return FText::GetEmpty();
	}

	FText ScarcityWord(float S)
	{
		if (S >= 75.f) return LOCTEXT("VeryScarce", "very scarce");
		if (S >= 60.f) return LOCTEXT("Scarce", "scarce");
		if (S <= 25.f) return LOCTEXT("VeryAbundant", "very abundant");
		if (S <= 40.f) return LOCTEXT("Abundant", "abundant");
		return LOCTEXT("Steady", "steady");
	}
}

#undef LOCTEXT_NAMESPACE
