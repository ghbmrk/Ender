#include "Core/EnderGameInstance.h"

#include "Ender.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Reality/EnderRealityClient.h"
#include "Reality/EnderRealityTypes.h"
#include "Save/EnderSaveGame.h"
#include "Save/EnderSaveSubsystem.h"
#include "Telemetry/EnderTelemetrySubsystem.h"
#include "TimerManager.h"

UEnderGameInstance::UEnderGameInstance()
{
	CrossingMap = TSoftObjectPtr<UWorld>(FSoftObjectPath(TEXT("/Game/Maps/L_Crossing.L_Crossing")));
	DefaultRealmMap = TSoftObjectPtr<UWorld>(FSoftObjectPath(TEXT("/Game/Maps/L_AshenVault.L_AshenVault")));
	RealmMaps.Add(TEXT("ashen-vault"), DefaultRealmMap);
}

void UEnderGameInstance::Init()
{
	Super::Init();
	bTravelling = false;
}

bool UEnderGameInstance::EnterRealm(const FString& RealmId, bool bEconomyDriven)
{
	UEnderRealityClient* Client = GetSubsystem<UEnderRealityClient>();
	if (bTravelling || !Client || Client->IsRealmActive())
	{
		return false;
	}
	bTravelling = true;
	PendingRealmId = RealmId;

	if (UEnderTelemetrySubsystem* Telemetry = GetSubsystem<UEnderTelemetrySubsystem>())
	{
		Telemetry->RecordRealmSelection(RealmId, bEconomyDriven);
	}
	const UEnderSaveSubsystem* SaveSys = GetSubsystem<UEnderSaveSubsystem>();
	const UEnderSaveGame* Save = SaveSys ? SaveSys->GetSave() : nullptr;
	const bool bTutorial = !Save || !Save->bTutorialComplete;

	OnRealmLoading(RealmId);
	Client->PrefetchRealmNative(RealmId, bTutorial, FEnderOnPrefetchNative::CreateUObject(this, &ThisClass::HandlePrefetched));
	return true;
}

void UEnderGameInstance::HandlePrefetched(bool bOnline, const FEnderRealmPrefetch& Prefetch)
{
	if (!Prefetch.bValid)
	{
		UE_LOG(LogEnder, Warning, TEXT("EnterRealm: prefetch for %s failed and offline play is disabled"), *PendingRealmId);
		bTravelling = false;
		OnRealmReady(PendingRealmId, false);
		return;
	}
	OnRealmReady(PendingRealmId, bOnline);

	const TSoftObjectPtr<UWorld>* Found = RealmMaps.Find(PendingRealmId);
	const TSoftObjectPtr<UWorld> Map = Found && !Found->IsNull() ? *Found : DefaultRealmMap;
	bTravelling = false;
	// The Realm map's game mode starts the Realm from the stored prefetch.
	UGameplayStatics::OpenLevelBySoftObjectPtr(this, Map);
}

void UEnderGameInstance::ReturnToCrossing(float Delay)
{
	// The game instance's timer manager survives the map change.
	GetTimerManager().ClearTimer(ReturnTimer);
	if (Delay <= 0.f)
	{
		OpenCrossing();
		return;
	}
	GetTimerManager().SetTimer(ReturnTimer, FTimerDelegate::CreateUObject(this, &ThisClass::OpenCrossing), Delay, false);
}

void UEnderGameInstance::OpenCrossing()
{
	if (UEnderRealityClient* Client = GetSubsystem<UEnderRealityClient>())
	{
		Client->ClearPrefetch();
	}
	UGameplayStatics::OpenLevelBySoftObjectPtr(this, CrossingMap);
}
