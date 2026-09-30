#pragma once

#include "Engine/DeveloperSettings.h"
#include "EnderRealitySettings.generated.h"

/**
 * Project Settings → Game → Ender Reality. The client talks only to the local
 * reality service (reality-service/), never to a scientific or market provider.
 */
UCLASS(config = Game, defaultconfig, meta = (DisplayName = "Ender Reality"))
class ENDER_API UEnderRealitySettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	UEnderRealitySettings();

	virtual FName GetCategoryName() const override { return TEXT("Game"); }

	UPROPERTY(config, EditAnywhere, Category = "Service")
	FString ServiceBaseUrl = TEXT("http://127.0.0.1:8788");

	UPROPERTY(config, EditAnywhere, Category = "Service", meta = (ClampMin = "0.5", ClampMax = "30"))
	float RequestTimeoutSeconds = 4.0f;

	/** When the service is unreachable the Realm still plays; Forms are replaced by ordinary loot. */
	UPROPERTY(config, EditAnywhere, Category = "Service")
	bool bAllowOfflineFallback = true;

	/** Developer only: ask for the scientific record behind Forms (?provenance=1). Never shown to players. */
	UPROPERTY(config, EditAnywhere, Category = "Developer")
	bool bRequestDeveloperProvenance = false;

	static const UEnderRealitySettings* Get() { return GetDefault<UEnderRealitySettings>(); }
};
