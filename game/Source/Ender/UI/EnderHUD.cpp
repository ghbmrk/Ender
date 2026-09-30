#include "UI/EnderHUD.h"

#include "Blueprint/UserWidget.h"
#include "Character/EnderPlayerController.h"
#include "Encounters/EnderRealmSubsystem.h"
#include "Ender.h"
#include "GameFramework/PlayerController.h"
#include "Items/EnderInteractable.h"
#include "Items/EnderLootSubsystem.h"
#include "UI/EnderHUDWidgets.h"
#include "UI/EnderMenuWidgets.h"

namespace
{
	TSoftClassPtr<UEnderMenuWidget> MenuClass(const TCHAR* Name)
	{
		return TSoftClassPtr<UEnderMenuWidget>(FSoftObjectPath(FString::Printf(TEXT("/Game/UI/%s.%s_C"), Name, Name)));
	}
}

AEnderHUD::AEnderHUD()
{
	HUDWidgetClass = TSoftClassPtr<UEnderHUDWidget>(FSoftObjectPath(TEXT("/Game/UI/WBP_HUD.WBP_HUD_C")));
	MenuClasses.Add(EEnderMenu::Inventory, MenuClass(TEXT("WBP_Inventory")));
	MenuClasses.Add(EEnderMenu::Crucible, MenuClass(TEXT("WBP_Crucible")));
	MenuClasses.Add(EEnderMenu::Bazaar, MenuClass(TEXT("WBP_Bazaar")));
	MenuClasses.Add(EEnderMenu::PassiveTree, MenuClass(TEXT("WBP_PassiveTree")));
	MenuClasses.Add(EEnderMenu::RealmGate, MenuClass(TEXT("WBP_RealmGate")));
	MenuClasses.Add(EEnderMenu::Attunement, MenuClass(TEXT("WBP_Attunement")));
	MenuClasses.Add(EEnderMenu::Grimoire, MenuClass(TEXT("WBP_Grimoire")));
}

void AEnderHUD::BeginPlay()
{
	Super::BeginPlay();
	APlayerController* PC = GetOwningPlayerController();
	if (!PC || !PC->IsLocalController())
	{
		return;
	}
	if (UClass* Class = HUDWidgetClass.LoadSynchronous())
	{
		HUDWidget = CreateWidget<UEnderHUDWidget>(PC, Class);
		if (HUDWidget)
		{
			HUDWidget->AddToViewport(0);
		}
	}
	else
	{
		UE_LOG(LogEnder, Warning, TEXT("AEnderHUD: HUD widget class %s not found"), *HUDWidgetClass.ToString());
	}

	if (AEnderPlayerController* EPC = Cast<AEnderPlayerController>(PC))
	{
		EPC->OnInteract.AddUniqueDynamic(this, &ThisClass::Interact);
		EPC->OnToggleInventory.AddUniqueDynamic(this, &ThisClass::ToggleInventory);
		EPC->OnToggleRealmMap.AddUniqueDynamic(this, &ThisClass::ToggleRealmMap);
		EPC->OnLootLabels.AddUniqueDynamic(this, &ThisClass::SetLootLabelsVisible);
	}
}

void AEnderHUD::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (AEnderPlayerController* EPC = Cast<AEnderPlayerController>(GetOwningPlayerController()))
	{
		EPC->OnInteract.RemoveDynamic(this, &ThisClass::Interact);
		EPC->OnToggleInventory.RemoveDynamic(this, &ThisClass::ToggleInventory);
		EPC->OnToggleRealmMap.RemoveDynamic(this, &ThisClass::ToggleRealmMap);
		EPC->OnLootLabels.RemoveDynamic(this, &ThisClass::SetLootLabelsVisible);
	}
	Super::EndPlay(EndPlayReason);
}

UEnderMenuWidget* AEnderHUD::GetOrCreateMenu(EEnderMenu Menu)
{
	if (TObjectPtr<UEnderMenuWidget>* Existing = Menus.Find(Menu))
	{
		if (*Existing)
		{
			return *Existing;
		}
	}
	const TSoftClassPtr<UEnderMenuWidget>* Soft = MenuClasses.Find(Menu);
	UClass* Class = Soft ? Soft->LoadSynchronous() : nullptr;
	APlayerController* PC = GetOwningPlayerController();
	if (!Class || !PC)
	{
		UE_LOG(LogEnder, Warning, TEXT("AEnderHUD: no widget class for menu %d"), static_cast<int32>(Menu));
		return nullptr;
	}
	UEnderMenuWidget* Widget = CreateWidget<UEnderMenuWidget>(PC, Class);
	Menus.Add(Menu, Widget);
	return Widget;
}

void AEnderHUD::OpenMenu(EEnderMenu Menu)
{
	if (Menu == EEnderMenu::None)
	{
		CloseMenus();
		return;
	}
	if (OpenMenuKind == Menu)
	{
		return;
	}
	CloseMenus();
	UEnderMenuWidget* Widget = GetOrCreateMenu(Menu);
	if (!Widget)
	{
		return;
	}
	Widget->AddToViewport(10);
	OpenMenuKind = Menu;
	SetMenuInput(true);
	Widget->Opened();
}

void AEnderHUD::CloseMenus()
{
	if (OpenMenuKind == EEnderMenu::None)
	{
		return;
	}
	const EEnderMenu Was = OpenMenuKind;
	OpenMenuKind = EEnderMenu::None;
	if (TObjectPtr<UEnderMenuWidget>* Widget = Menus.Find(Was))
	{
		if (*Widget)
		{
			(*Widget)->Closed();
			(*Widget)->RemoveFromParent();
		}
	}
	SetMenuInput(false);
}

void AEnderHUD::SetMenuInput(bool bMenuOpen)
{
	APlayerController* PC = GetOwningPlayerController();
	if (!PC)
	{
		return;
	}
	if (AEnderPlayerController* EPC = Cast<AEnderPlayerController>(PC))
	{
		EPC->SetGameplayInputEnabled(!bMenuOpen);
	}
	FInputModeGameAndUI Mode;
	Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
	Mode.SetHideCursorDuringCapture(false);
	if (bMenuOpen)
	{
		if (TObjectPtr<UEnderMenuWidget>* Widget = Menus.Find(OpenMenuKind))
		{
			if (*Widget)
			{
				Mode.SetWidgetToFocus((*Widget)->TakeWidget());
			}
		}
	}
	PC->SetInputMode(Mode);
	PC->SetShowMouseCursor(true);
}

void AEnderHUD::ToggleInventory()
{
	if (OpenMenuKind == EEnderMenu::Inventory)
	{
		CloseMenus();
	}
	else
	{
		OpenMenu(EEnderMenu::Inventory);
	}
}

void AEnderHUD::ToggleRealmMap()
{
	const UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this);
	if (Realm && Realm->IsRealmActive())
	{
		if (HUDWidget)
		{
			HUDWidget->OnToggleMap();
		}
		return;
	}
	if (OpenMenuKind == EEnderMenu::RealmGate)
	{
		CloseMenus();
	}
	else
	{
		OpenMenu(EEnderMenu::RealmGate);
	}
}

void AEnderHUD::SetLootLabelsVisible(bool bVisible)
{
	if (UEnderLootSubsystem* Loot = UEnderLootSubsystem::Get(this))
	{
		Loot->SetLabelsVisible(bVisible);
	}
}

void AEnderHUD::Interact()
{
	if (IsAnyMenuOpen())
	{
		return;
	}
	const APlayerController* PC = GetOwningPlayerController();
	if (APawn* Pawn = PC ? PC->GetPawn() : nullptr)
	{
		UEnderInteractionLibrary::TryInteract(Pawn);
	}
}
