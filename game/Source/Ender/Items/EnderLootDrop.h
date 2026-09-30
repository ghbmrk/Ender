#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Items/EnderFormTypes.h"
#include "Items/EnderInteractable.h"
#include "EnderLootDrop.generated.h"

class USphereComponent;
class UStaticMeshComponent;
class UWidgetComponent;

/**
 * Loot on the floor. Picked up with Interact (F / A-Cross); its label (WBP_LootLabel
 * in LabelWidget) shows while loot labels are held (Alt). Forms render with custom
 * stencil 6 (valuable loot), everything else with 5 (interactable). NS_LootBeam is
 * spawned by the Blueprint in OnLootBeam.
 */
UCLASS(Blueprintable)
class ENDER_API AEnderLootDrop : public AActor, public IEnderInteractable
{
	GENERATED_BODY()

public:
	AEnderLootDrop();

	/** Call right after spawning (before the first frame). */
	void InitializeLoot(const FEnderLootPayload& InPayload);

	UFUNCTION(BlueprintPure, Category = "Ender|Loot") FEnderLootPayload GetPayload() const { return Payload; }

	UFUNCTION(BlueprintCallable, Category = "Ender|Loot") void SetLabelVisible(bool bVisible);

	virtual bool CanInteract_Implementation(APawn* Instigator) const override;
	virtual void Interact_Implementation(APawn* Instigator) override;
	virtual FText GetInteractPrompt_Implementation() const override;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

	/** Spawn NS_LootBeam here; Color follows the rarity palette. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Loot") void OnLootBeam(bool bValuable, FLinearColor Color);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Loot") void OnPickedUp(APawn* ByPawn);
	/** Label widget should read GetPayload() here (UEnderLootLabelWidget does it automatically). */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Loot") void OnPayloadSet();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Loot") TObjectPtr<USphereComponent> PickupSphere;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Loot") TObjectPtr<UStaticMeshComponent> Mesh;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Loot") TObjectPtr<UWidgetComponent> LabelWidget;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Ender|Loot") FEnderLootPayload Payload;

private:
	bool bPickedUp = false;
};
