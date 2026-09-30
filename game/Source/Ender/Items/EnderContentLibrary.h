#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "EnderContentLibrary.generated.h"

/**
 * Small helpers for editor Python (Tools/Python/create_ender_assets.py): gameplay
 * tags and text-imported property values are awkward to build from Python.
 */
UCLASS()
class ENDER_API UEnderContentLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** The registered tag, or an empty tag when TagName is unknown or empty. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Content")
	static FGameplayTag MakeGameplayTag(const FString& TagName);

	/** Sets a property from Unreal's text form (e.g. a tag as (TagName="Cooldown.Bind")). Marks the object modified. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Content")
	static bool SetPropertyFromText(UObject* Object, FName PropertyName, const FString& Text);
};
