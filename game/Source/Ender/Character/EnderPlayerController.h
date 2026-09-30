#pragma once

#include "GameFramework/PlayerController.h"
#include "InputActionValue.h"
#include "EnderPlayerController.generated.h"

class UInputAction;
class UInputMappingContext;
class AEnderPlayerCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FEnderOnUIAction);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnLootLabels, bool, bShow);

/**
 * §17 input through Enhanced Input. Skills and Evade never execute directly: every
 * press goes to the Binder's UEnderCombatInputBuffer (§18). Movement is camera
 * relative (the camera's 45° yaw), aim is the mouse's ground point or the right
 * stick, and whichever device moved last owns aim. No camera rotation input.
 */
UCLASS()
class ENDER_API AEnderPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AEnderPlayerController();

	UPROPERTY(BlueprintAssignable, Category = "Ender|Input") FEnderOnUIAction OnInteract;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Input") FEnderOnUIAction OnToggleInventory;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Input") FEnderOnUIAction OnToggleRealmMap;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Input") FEnderOnLootLabels OnLootLabels;

	/** Ground point under the cursor at the Binder's feet height. */
	UFUNCTION(BlueprintPure, Category = "Ender|Input")
	bool GetCursorGroundPoint(FVector& OutPoint) const;

	/** Gameplay input off while a menu (Crucible, Bazaar…) has focus. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Input")
	void SetGameplayInputEnabled(bool bEnabled);

protected:
	virtual void SetupInputComponent() override;
	virtual void OnPossess(APawn* InPawn) override;
	virtual void PlayerTick(float DeltaTime) override;

	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputMappingContext> MappingContext;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> MoveAction;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> AimStickAction;
	/** Skill 1–6 (LMB/RT, RMB/LT, 1/X, 2/Y, 3/RB, 4/LB). */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TArray<TSoftObjectPtr<UInputAction>> SkillActions;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> EvadeAction;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> DraughtAction;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> InteractAction;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> InventoryAction;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> MapAction;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> LootLabelsAction;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") TSoftObjectPtr<UInputAction> ZoomAction;

	/** Right-stick aim distance from the Binder. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") float StickAimDistance = 500.f;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Input") float StickDeadzone = 0.2f;

private:
	AEnderPlayerCharacter* Binder() const;
	FVector CameraRelative(const FVector2D& Input) const;

	void Move(const FInputActionValue& Value);
	void MoveStopped(const FInputActionValue& Value);
	void AimStick(const FInputActionValue& Value);
	void Skill(const FInputActionValue& Value, int32 Slot);
	void Evade(const FInputActionValue& Value);
	void Draught(const FInputActionValue& Value);
	void Interact(const FInputActionValue& Value) { OnInteract.Broadcast(); }
	void Inventory(const FInputActionValue& Value) { OnToggleInventory.Broadcast(); }
	void Map(const FInputActionValue& Value) { OnToggleRealmMap.Broadcast(); }
	void LootLabelsOn(const FInputActionValue& Value) { OnLootLabels.Broadcast(true); }
	void LootLabelsOff(const FInputActionValue& Value) { OnLootLabels.Broadcast(false); }
	void Zoom(const FInputActionValue& Value);

	FVector2D LastMouse = FVector2D::ZeroVector;
	bool bStickAim = false;
	bool bGameplayInput = true;
};
