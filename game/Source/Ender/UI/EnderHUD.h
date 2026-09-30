#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "EnderHUD.generated.h"

class UEnderHUDWidget;
class UEnderMenuWidget;

UENUM(BlueprintType)
enum class EEnderMenu : uint8
{
	None,
	Inventory,
	Crucible,
	Bazaar,
	PassiveTree,
	RealmGate,
	Attunement,
	Grimoire,
};

/**
 * Owns WBP_HUD and the menus. One menu at a time; while a menu is open gameplay
 * input is off (AEnderPlayerController::SetGameplayInputEnabled) and the cursor
 * drives the UI. Widget classes default to /Game/UI/WBP_*. BeginPlay binds the
 * owning AEnderPlayerController's OnInteract / OnToggleInventory /
 * OnToggleRealmMap / OnLootLabels to Interact / ToggleInventory / ToggleRealmMap /
 * SetLootLabelsVisible.
 */
UCLASS()
class ENDER_API AEnderHUD : public AHUD
{
	GENERATED_BODY()

public:
	AEnderHUD();

	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void OpenMenu(EEnderMenu Menu);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void CloseMenus();
	/** Tab: Inventory open/close. */
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void ToggleInventory();
	/** M: inside a Realm expands the minimap; in the Crossing opens the Realm Gate. */
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void ToggleRealmMap();
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SetLootLabelsVisible(bool bVisible);
	/** F / A: use the best interactable in reach (ignored while a menu is open). */
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void Interact();

	UFUNCTION(BlueprintPure, Category = "Ender|UI") bool IsAnyMenuOpen() const { return OpenMenuKind != EEnderMenu::None; }
	UFUNCTION(BlueprintPure, Category = "Ender|UI") EEnderMenu GetOpenMenu() const { return OpenMenuKind; }
	UFUNCTION(BlueprintPure, Category = "Ender|UI") UEnderHUDWidget* GetHUDWidget() const { return HUDWidget; }

	UPROPERTY(EditDefaultsOnly, Category = "Ender|UI") TSoftClassPtr<UEnderHUDWidget> HUDWidgetClass;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|UI") TMap<EEnderMenu, TSoftClassPtr<UEnderMenuWidget>> MenuClasses;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	UEnderMenuWidget* GetOrCreateMenu(EEnderMenu Menu);
	void SetMenuInput(bool bMenuOpen);

	UPROPERTY() TObjectPtr<UEnderHUDWidget> HUDWidget;
	UPROPERTY() TMap<EEnderMenu, TObjectPtr<UEnderMenuWidget>> Menus;
	EEnderMenu OpenMenuKind = EEnderMenu::None;
};
