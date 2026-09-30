#include "Save/EnderSaveSubsystem.h"

#include "Ender.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Reality/EnderRealityClient.h"
#include "Save/EnderSaveGame.h"

using EnderSave::SlotName;
using EnderSave::UserIndex;

UEnderSaveSubsystem* UEnderSaveSubsystem::Get(const UObject* WorldContext)
{
	const UWorld* W = GEngine ? GEngine->GetWorldFromContextObject(WorldContext, EGetWorldErrorMode::ReturnNull) : nullptr;
	const UGameInstance* GI = W ? W->GetGameInstance() : nullptr;
	return GI ? GI->GetSubsystem<UEnderSaveSubsystem>() : nullptr;
}

void UEnderSaveSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency(UEnderRealityClient::StaticClass());
	Super::Initialize(Collection);

	if (UGameplayStatics::DoesSaveGameExist(SlotName, UserIndex))
	{
		Save = Cast<UEnderSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName, UserIndex));
	}
	if (!Save)
	{
		Save = Cast<UEnderSaveGame>(UGameplayStatics::CreateSaveGameObject(UEnderSaveGame::StaticClass()));
	}
	UE_LOG(LogEnder, Log, TEXT("Save loaded: level %d, %d Forms, world %s"), Save->Character.Level, Save->Forms.Num(), *Save->WorldReplayDate);

	if (UEnderRealityClient* Client = GetGameInstance()->GetSubsystem<UEnderRealityClient>())
	{
		Client->RestoreDeferred(Save->DeferredRequests);
		Client->OnCharacterUpdated.AddDynamic(this, &ThisClass::HandleCharacterUpdated);
		Client->OnWorldStateUpdated.AddDynamic(this, &ThisClass::HandleWorldUpdated);
	}
}

void UEnderSaveSubsystem::Deinitialize()
{
	if (Save && !bSaveInFlight)
	{
		if (const UEnderRealityClient* Client = GetGameInstance()->GetSubsystem<UEnderRealityClient>())
		{
			Save->DeferredRequests = Client->GetDeferred();
		}
		UGameplayStatics::SaveGameToSlot(Save, SlotName, UserIndex);
	}
	Super::Deinitialize();
}

void UEnderSaveSubsystem::SaveNow()
{
	if (!Save)
	{
		return;
	}
	if (bSaveInFlight)
	{
		bSaveAgain = true;
		return;
	}
	if (const UEnderRealityClient* Client = GetGameInstance()->GetSubsystem<UEnderRealityClient>())
	{
		Save->DeferredRequests = Client->GetDeferred();
	}
	bSaveInFlight = true;
	UGameplayStatics::AsyncSaveGameToSlot(Save, SlotName, UserIndex,
		FAsyncSaveGameToSlotDelegate::CreateUObject(this, &ThisClass::HandleAsyncSaved));
}

void UEnderSaveSubsystem::HandleAsyncSaved(const FString& Slot, int32 User, bool bSuccess)
{
	bSaveInFlight = false;
	if (!bSuccess)
	{
		UE_LOG(LogEnder, Warning, TEXT("Saving %s failed"), *Slot);
	}
	OnSaved.Broadcast(bSuccess);
	if (bSaveAgain)
	{
		bSaveAgain = false;
		SaveNow();
	}
}

void UEnderSaveSubsystem::ResetSave()
{
	UGameplayStatics::DeleteGameInSlot(SlotName, UserIndex);
	Save = Cast<UEnderSaveGame>(UGameplayStatics::CreateSaveGameObject(UEnderSaveGame::StaticClass()));
	SaveNow();
}

void UEnderSaveSubsystem::HandleCharacterUpdated(const FEnderCharacterProgress& Character)
{
	if (!Save || !Character.bValid)
	{
		return;
	}
	Save->Character = Character;
	Save->PassiveAllocations = Character.Passives;
	Save->Mastery = Character.Mastery;
	Save->Crowns = Character.Crowns;
	if (!Character.WorldDate.IsEmpty())
	{
		Save->WorldReplayDate = Character.WorldDate;
	}
	SaveNow();
}

void UEnderSaveSubsystem::HandleWorldUpdated(const FEnderWorldState& World)
{
	if (Save && World.bValid)
	{
		Save->WorldReplayDate = World.Date;
		Save->WorldSnapshotId = World.SnapshotId;
	}
}
