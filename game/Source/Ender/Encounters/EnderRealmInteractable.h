#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Items/EnderInteractable.h"
#include "EnderRealmInteractable.generated.h"

class USphereComponent;
class UStaticMeshComponent;

UENUM(BlueprintType)
enum class EEnderRealmInteraction : uint8
{
	AttunementShrine,
	RewardAltar,
	ReturnPortal,
	/** Crossing: choose the next Realm (WBP_RealmGate). */
	RealmGate,
	Bazaar,
	Crucible,
	Grimoire,
	PassiveTree,
};

/** Shrine, altar, portal and the Crossing's stations. Outlined with stencil 5 (interactable). */
UCLASS(Blueprintable)
class ENDER_API AEnderRealmInteractable : public AActor, public IEnderInteractable
{
	GENERATED_BODY()

public:
	AEnderRealmInteractable();

	virtual bool CanInteract_Implementation(APawn* Instigator) const override;
	virtual void Interact_Implementation(APawn* Instigator) override;
	virtual FText GetInteractPrompt_Implementation() const override;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Interact") EEnderRealmInteraction Interaction = EEnderRealmInteraction::AttunementShrine;

protected:
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Interact") void OnUsed(APawn* ByPawn);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Interact") TObjectPtr<USphereComponent> UseSphere;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Interact") TObjectPtr<UStaticMeshComponent> Mesh;
};
