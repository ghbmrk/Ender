#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"
#include "Reality/EnderRealityTypes.h"

/**
 * JSON → USTRUCT for the reality service's responses (reality-service/src/routes.ts,
 * views.ts, and the /api/* views of apps/server). Tolerant: missing fields keep
 * their defaults, so a newer service never breaks an older client.
 */
namespace EnderRealityJson
{
	ENDER_API FString ToString(const TSharedRef<FJsonObject>& Object);
	ENDER_API TSharedPtr<FJsonObject> Parse(const FString& Text);

	ENDER_API void ParseWorld(const FJsonObject& J, FEnderWorldState& Out);
	ENDER_API void ParseRealmView(const FJsonObject& J, FEnderRealmPrefetch& Out); // card + preload
	ENDER_API void ParseRealmCard(const FJsonObject& J, FEnderRealmGateCard& Out);
	ENDER_API void ParseContract(const FJsonObject& J, FEnderContract& Out);
	ENDER_API void ParseContracts(const FJsonObject& J, TArray<FEnderContract>& Out); // GET /contracts
	ENDER_API void ParseBazaar(const FJsonObject& J, FEnderBazaarState& Out);
	ENDER_API void ParseNeighbors(const FJsonObject& J, TArray<FEnderCandidate>& Out);
	/** GET /realm/:id/pool: every candidate the server draws this Realm's Forms from, with its percentile. */
	ENDER_API void ParseRealmPool(const FJsonObject& J, TArray<FEnderCandidate>& Out);
	ENDER_API void ParseCandidate(const FJsonObject& J, FEnderCandidate& Out);
	ENDER_API void ParseArtifact(const FJsonObject& J, FEnderForm& Out);
	ENDER_API void ParseRunStart(const FJsonObject& J, FEnderRunPlan& Out);
	ENDER_API void ParseCharacter(const FJsonObject& J, FEnderCharacterProgress& Out);
	ENDER_API void ParsePassives(const FJsonObject& J, FEnderPassiveTree& Out);
	ENDER_API void ParseUsage(const FJsonObject& Envelope, FEnderInferenceUsage& Out);
	/** Attune envelope result → fantasy name, epithet and at most two Familiar lines. */
	ENDER_API void ParseAttuneResult(const FJsonObject& Result, FText& OutName, FText& OutEpithet, TArray<FText>& OutLines);
	ENDER_API void ParseTemperChoices(const FJsonObject& Result, TArray<FEnderTemperChoice>& Out, FText& OutSummary);
	ENDER_API void ParseCritique(const FJsonObject& Result, FEnderCritique& Out);
	ENDER_API void ParseEssenceMap(const FJsonObject& J, TArray<FEnderEssenceAmount>& Out);
	ENDER_API void ParseQualities(const FJsonObject& J, TArray<float>& Out);
}
