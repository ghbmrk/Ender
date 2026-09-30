#pragma once

#include "Engine/DeveloperSettings.h"
#include "EnderAISettings.generated.h"

class AEnderTelegraph;
class AEnderEnemyProjectile;
class AEnderHazardPool;

/** Project-wide classes for pooled combat actors (Project Settings → Game → Ender AI). */
UCLASS(Config = Game, DefaultConfig, meta = (DisplayName = "Ender AI"))
class ENDER_API UEnderAISettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	virtual FName GetCategoryName() const override { return TEXT("Game"); }

	/** Blueprint subclasses carry the decal material and Niagara (NS_TelegraphCircle / NS_TelegraphCone). */
	UPROPERTY(Config, EditAnywhere, Category = "Pools") TSoftClassPtr<AEnderTelegraph> TelegraphClass;
	UPROPERTY(Config, EditAnywhere, Category = "Pools") TSoftClassPtr<AEnderEnemyProjectile> ProjectileClass;
	UPROPERTY(Config, EditAnywhere, Category = "Pools") TSoftClassPtr<AEnderHazardPool> HazardPoolClass;
};

DECLARE_MULTICAST_DELEGATE_OneParam(FEnderOnColourblindChanged, bool /*bEnabled*/);

/**
 * Player-facing accessibility options that combat visuals read. Saved per user
 * (GameUserSettings.ini), so the settings menu calls the setters directly.
 */
UCLASS(Config = GameUserSettings, meta = (DisplayName = "Ender Accessibility"))
class ENDER_API UEnderAccessibilitySettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	virtual FName GetCategoryName() const override { return TEXT("Game"); }

	/** Telegraphs switch to a diagonal animated hatch with a thicker boundary. */
	UFUNCTION(BlueprintPure, Category = "Ender|Accessibility")
	static bool IsColourblindTelegraphs();

	UFUNCTION(BlueprintCallable, Category = "Ender|Accessibility")
	static void SetColourblindTelegraphs(bool bEnabled);

	/** Live telegraphs subscribe so a change applies mid-fight. */
	static FEnderOnColourblindChanged OnColourblindChanged;

	UPROPERTY(Config, EditAnywhere, Category = "Telegraphs") bool bColourblindTelegraphs = false;
};
