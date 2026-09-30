#include "Core/EnderGameMode.h"

#include "Character/EnderPlayerCharacter.h"
#include "Character/EnderPlayerController.h"
#include "Encounters/EnderBossArena.h"
#include "Encounters/EnderEncounterDirector.h"
#include "Encounters/EnderRealmSubsystem.h"
#include "Ender.h"
#include "EngineUtils.h"
#include "Inventory/EnderInventoryComponent.h"
#include "Items/EnderLootProfile.h"
#include "UI/EnderHUD.h"

AEnderGameMode::AEnderGameMode()
{
	DefaultPawnClass = AEnderPlayerCharacter::StaticClass();
	PlayerControllerClass = AEnderPlayerController::StaticClass();
	HUDClass = AEnderHUD::StaticClass();
	PlayerPawnClass = TSoftClassPtr<APawn>(FSoftObjectPath(TEXT("/Game/Characters/BP_Binder.BP_Binder_C")));
	LootProfile = TSoftObjectPtr<UEnderLootProfile>(FSoftObjectPath(TEXT("/Game/Data/DA_LootProfile_Default.DA_LootProfile_Default")));
}

UClass* AEnderGameMode::GetDefaultPawnClassForController_Implementation(AController* InController)
{
	if (!PlayerPawnClass.IsNull())
	{
		if (UClass* Loaded = PlayerPawnClass.LoadSynchronous())
		{
			return Loaded;
		}
	}
	return Super::GetDefaultPawnClassForController_Implementation(InController);
}

bool AEnderGameMode::IsRealmMap() const
{
	if (bForceRealm)
	{
		return true;
	}
	UWorld* World = GetWorld();
	if (!World)
	{
		return false;
	}
	return TActorIterator<AEnderEncounterDirector>(World) || TActorIterator<AEnderBossArena>(World);
}

void AEnderGameMode::StartPlay()
{
	// Start the Realm before BeginPlay runs on actors so room triggers see an active Realm.
	if (IsRealmMap())
	{
		if (UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this))
		{
			UEnderLootProfile* Profile = LootProfile.LoadSynchronous();
			if (!Profile)
			{
				UE_LOG(LogEnder, Warning, TEXT("AEnderGameMode: loot profile %s missing; drops use defaults"), *LootProfile.ToString());
			}
			Realm->StartRealmFromPrefetch(Profile);
		}
	}
	Super::StartPlay();
}

void AEnderGameMode::SetPlayerDefaults(APawn* PlayerPawn)
{
	Super::SetPlayerDefaults(PlayerPawn);
	if (PlayerPawn && !UEnderInventoryComponent::FindFor(PlayerPawn))
	{
		UEnderInventoryComponent* Inventory = NewObject<UEnderInventoryComponent>(PlayerPawn, TEXT("Inventory"));
		PlayerPawn->AddInstanceComponent(Inventory);
		Inventory->RegisterComponent();
	}
}
