#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "UObject/Interface.h"
#include "EnderInteractable.generated.h"

class APawn;

UINTERFACE(BlueprintType)
class ENDER_API UEnderInteractable : public UInterface
{
	GENERATED_BODY()
};

/** Anything F / A (Cross) can use: loot, the Attunement Shrine, the Reward Altar, portals, the Realm Gate. */
class ENDER_API IEnderInteractable
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Ender|Interact")
	bool CanInteract(APawn* Instigator) const;

	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Ender|Interact")
	void Interact(APawn* Instigator);

	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Ender|Interact")
	FText GetInteractPrompt() const;
};

UCLASS()
class ENDER_API UEnderInteractionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Nearest usable interactable within Radius of the pawn (loot first when equally close). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Interact")
	static AActor* FindBestInteractable(APawn* Pawn, float Radius = 250.f);

	/** Interacts with FindBestInteractable; returns false when nothing is in reach. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Interact")
	static bool TryInteract(APawn* Pawn, float Radius = 250.f);
};
