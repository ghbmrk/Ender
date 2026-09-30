#include "Encounters/EnderRealmSubsystem.h"

#include "Character/EnderPlayerCharacter.h"
#include "Combat/EnderRunRandomSubsystem.h"
#include "Core/EnderGameInstance.h"
#include "Encounters/EnderEncounterDirector.h"
#include "Ender.h"
#include "Engine/World.h"
#include "Inventory/EnderInventoryComponent.h"
#include "Items/EnderLootProfile.h"
#include "Items/EnderLootSubsystem.h"
#include "Kismet/GameplayStatics.h"
#include "Reality/EnderRealityClient.h"
#include "Save/EnderSaveGame.h"
#include "Save/EnderSaveSubsystem.h"
#include "Telemetry/EnderTelemetrySubsystem.h"

namespace
{
	EEnderRealmSegment SegmentForRoom(EEnderRoomKind Kind)
	{
		switch (Kind)
		{
		case EEnderRoomKind::Room1: return EEnderRealmSegment::Room1;
		case EEnderRoomKind::Room2: return EEnderRealmSegment::Room2;
		case EEnderRoomKind::Room3: return EEnderRealmSegment::Room3;
		case EEnderRoomKind::Room4: return EEnderRealmSegment::Room4;
		case EEnderRoomKind::Elite: return EEnderRealmSegment::Elite;
		}
		return EEnderRealmSegment::Room1;
	}

	EnderRules::ERealmSegment ToRules(EEnderRealmSegment S) { return static_cast<EnderRules::ERealmSegment>(S); }
	EEnderRealmSegment FromRules(EnderRules::ERealmSegment S) { return static_cast<EEnderRealmSegment>(S); }
}

UEnderRealmSubsystem* UEnderRealmSubsystem::Get(const UObject* WorldContext)
{
	const UWorld* W = WorldContext ? WorldContext->GetWorld() : nullptr;
	return W ? W->GetSubsystem<UEnderRealmSubsystem>() : nullptr;
}

void UEnderRealmSubsystem::StartRealmFromPrefetch(UEnderLootProfile* LootProfile)
{
	UEnderRealityClient* Client = UEnderRealityClient::Get(this);
	const UEnderSaveSubsystem* SaveSys = UEnderSaveSubsystem::Get(this);
	const bool bTutorial = SaveSys && SaveSys->GetSave() && !SaveSys->GetSave()->bTutorialComplete;
	FEnderRealmPrefetch Data;
	if (Client && Client->HasPrefetch())
	{
		Data = Client->GetPrefetch();
	}
	else if (Client)
	{
		// No prefetch (e.g. PIE straight into a Realm map): the Realm plays offline with ordinary loot.
		Data = Client->MakeOfflinePrefetch(TEXT("ashen-vault"), bTutorial);
		Client->SetPrefetch(Data);
	}
	else
	{
		Data.bValid = true;
		Data.bOffline = true;
		Data.bTutorial = bTutorial;
	}
	StartRealm(Data, LootProfile);
}

void UEnderRealmSubsystem::StartRealm(const FEnderRealmPrefetch& InPrefetch, UEnderLootProfile* LootProfile)
{
	Prefetch = InPrefetch;
	bActive = true;
	Segment = EEnderRealmSegment::Entry;
	Focus.Refresh(FMath::Max(0, Prefetch.Focus - EnderRules::Focus::PerRealm));
	Pacing = EnderRules::FPacingLog();
	SegmentSeconds = CombatSeconds = ActiveSeconds = 0.0;
	BossEngagedAt = BossPhaseStartedAt = -1.0;
	BossPhase = 1;
	BossPhaseSeconds.Reset();
	ClearedServiceRooms.Reset();
	Kills.Reset();
	Deaths = 0;

	if (UEnderRunRandomSubsystem* Run = GetWorld()->GetSubsystem<UEnderRunRandomSubsystem>())
	{
		Run->BeginRun(Prefetch.RunSeed);
	}
	if (UEnderLootSubsystem* Loot = GetWorld()->GetSubsystem<UEnderLootSubsystem>())
	{
		Loot->BeginRealm(Prefetch, LootProfile);
	}
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->SetRealmActive(true);
	}
	if (AEnderPlayerCharacter* Binder = Cast<AEnderPlayerCharacter>(UGameplayStatics::GetPlayerPawn(this, 0)))
	{
		Binder->RefillDraughts();
	}
	UE_LOG(LogEnder, Log, TEXT("Realm %s started (%s%s), seed %lld, Focus %d"), *Prefetch.RealmId, Prefetch.bOffline ? TEXT("offline") : TEXT("online"),
		Prefetch.bTutorial ? TEXT(", tutorial") : TEXT(""), Prefetch.RunSeed, Focus.Current);
	OnSegmentChanged.Broadcast(EEnderRealmSegment::Entry, EEnderRealmSegment::Entry);
	OnFocusChanged.Broadcast(Focus.Current, Focus.Max);
}

bool UEnderRealmSubsystem::CanEnterSegment(EEnderRealmSegment Target) const
{
	return bActive && (Target == Segment || ToRules(Target) == EnderRules::RealmFlow::Next(ToRules(Segment)));
}

bool UEnderRealmSubsystem::AdvanceTo(EEnderRealmSegment Target)
{
	if (!bActive)
	{
		return false;
	}
	if (Target == Segment)
	{
		return true;
	}
	if (ToRules(Target) != EnderRules::RealmFlow::Next(ToRules(Segment)))
	{
		UE_LOG(LogEnder, Warning, TEXT("Realm: %s cannot follow %s"), *UEnum::GetValueAsString(Target), *UEnum::GetValueAsString(Segment));
		return false;
	}
	SetSegment(Target);
	return true;
}

void UEnderRealmSubsystem::SetSegment(EEnderRealmSegment Target)
{
	Pacing.Add(ToRules(Segment), SegmentSeconds);
	SegmentSeconds = 0.0;
	const EEnderRealmSegment From = Segment;
	Segment = Target;

	UEnderRealityClient* Client = UEnderRealityClient::Get(this);
	switch (Target)
	{
	case EEnderRealmSegment::AttunementShrine:
		// The shrine is the run's mid-point checkpoint (service room 5).
		if (Client)
		{
			Client->QueueRunCheckpoint(EnderRules::RealmFlow::ServiceRoomIndex(ToRules(Target)));
			Client->FlushRunCheckpoints();
		}
		break;
	case EEnderRealmSegment::RecoverySpace:
		if (AEnderPlayerCharacter* Binder = Cast<AEnderPlayerCharacter>(UGameplayStatics::GetPlayerPawn(this, 0)))
		{
			Binder->RefillDraughts();
		}
		break;
	default:
		break;
	}
	UE_LOG(LogEnder, Log, TEXT("Realm segment %s → %s"), *UEnum::GetValueAsString(From), *UEnum::GetValueAsString(Target));
	OnSegmentChanged.Broadcast(From, Target);
}

void UEnderRealmSubsystem::Tick(float DeltaTime)
{
	SegmentSeconds += DeltaTime;
	ActiveSeconds += DeltaTime;
	if (const UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		CombatSeconds += Client->IsInCombat() ? DeltaTime : 0.0;
	}
}

// ------------------------------------------------------------------ encounters

void UEnderRealmSubsystem::NotifyRoomStarted(AEnderEncounterDirector* Director)
{
	if (Director)
	{
		AdvanceTo(SegmentForRoom(Director->GetRoomKind()));
	}
}

void UEnderRealmSubsystem::NotifyRoomCleared(AEnderEncounterDirector* Director, float Seconds)
{
	if (!bActive || !Director)
	{
		return;
	}
	const int32 ServiceIndex = EnderRules::RealmFlow::ServiceRoomIndex(ToRules(SegmentForRoom(Director->GetRoomKind())));
	ClearedServiceRooms.AddUnique(ServiceIndex);
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		// Room clear is a safe moment: combat is over, nothing waits on the reply.
		Client->QueueRunCheckpoint(ServiceIndex);
		Client->FlushRunCheckpoints();
	}
	if (UEnderInventoryComponent* Inventory = UEnderInventoryComponent::FindFor(UGameplayStatics::GetPlayerPawn(this, 0)))
	{
		if (Inventory->IsDirty()) Inventory->Persist();
	}
	// Walk into the following non-combat segment (Connector, Shrine, Recovery Space).
	const EnderRules::ERealmSegment Next = EnderRules::RealmFlow::Next(ToRules(Segment));
	if (!EnderRules::RealmFlow::IsCombat(Next))
	{
		SetSegment(FromRules(Next));
	}
}

void UEnderRealmSubsystem::NotifyEnemyKilled(EEnderArchetype Archetype)
{
	Kills.FindOrAdd(UEnum::GetValueAsString(Archetype).RightChop(FString(TEXT("EEnderArchetype::")).Len()).ToLower())++;
}

void UEnderRealmSubsystem::NotifyBossEngaged(AActor* Boss)
{
	if (!AdvanceTo(EEnderRealmSegment::Boss))
	{
		return;
	}
	const double Now = GetWorld()->GetTimeSeconds();
	BossEngagedAt = BossPhaseStartedAt = Now;
	BossPhase = 1;
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->SetInCombat(true);
	}
}

void UEnderRealmSubsystem::NotifyBossPhase(int32 NewPhase)
{
	const double Now = GetWorld()->GetTimeSeconds();
	if (BossPhaseStartedAt >= 0.0)
	{
		const double Seconds = Now - BossPhaseStartedAt;
		BossPhaseSeconds.Add(Seconds);
		if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
		{
			Telemetry->RecordBossPhase(BossPhase, static_cast<float>(Seconds));
		}
	}
	BossPhase = NewPhase;
	BossPhaseStartedAt = Now;
}

void UEnderRealmSubsystem::NotifyBossDefeated(AActor* Boss)
{
	if (Segment != EEnderRealmSegment::Boss)
	{
		return;
	}
	const double Now = GetWorld()->GetTimeSeconds();
	NotifyBossPhase(BossPhase + 1); // closes the last phase's timing

	UEnderSaveSubsystem* SaveSys = UEnderSaveSubsystem::Get(this);
	UEnderSaveGame* Save = SaveSys ? SaveSys->GetSave() : nullptr;
	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		Telemetry->RecordBossKill(static_cast<float>(Now - BossEngagedAt), Save && Save->BossKills == 0);
	}
	if (Save)
	{
		++Save->BossKills;
	}
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->SetInCombat(false);
	}
	ClearedServiceRooms.AddUnique(EnderRules::RealmFlow::ServiceRoomIndex(EnderRules::ERealmSegment::Boss));
	if (UEnderLootSubsystem* Loot = GetWorld()->GetSubsystem<UEnderLootSubsystem>())
	{
		const APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
		const FVector Where = Boss ? Boss->GetActorLocation() : (Player ? Player->GetActorLocation() : FVector::ZeroVector);
		Loot->DropBossRewards(Where, EnderRules::RealmFlow::ServiceRoomIndex(EnderRules::ERealmSegment::Boss));
	}
	AdvanceTo(EEnderRealmSegment::RewardAltar);
}

void UEnderRealmSubsystem::NotifyPlayerDied(FName Cause)
{
	if (!bActive)
	{
		return;
	}
	++Deaths;
	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		Telemetry->RecordDeath(Cause);
	}
	EndRealm(TEXT("death"));
	if (UEnderGameInstance* GI = GetWorld()->GetGameInstance<UEnderGameInstance>())
	{
		GI->ReturnToCrossing(3.0f);
	}
}

// ------------------------------------------------------------------ interactables

void UEnderRealmSubsystem::ClaimRewardAltar()
{
	if (Segment != EEnderRealmSegment::RewardAltar)
	{
		return;
	}
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->FlushRunCheckpoints();
	}
}

void UEnderRealmSubsystem::UseReturnPortal()
{
	if (!AdvanceTo(EEnderRealmSegment::ReturnPortal))
	{
		return;
	}
	EndRealm(TEXT("victory"));
	if (UEnderGameInstance* GI = GetWorld()->GetGameInstance<UEnderGameInstance>())
	{
		GI->ReturnToCrossing(0.5f);
	}
}

void UEnderRealmSubsystem::EndRealm(const FString& Outcome)
{
	if (!bActive)
	{
		return;
	}
	Pacing.Add(ToRules(Segment), SegmentSeconds);
	bActive = false;

	const float CombatShare = ActiveSeconds > 0.0 ? static_cast<float>(CombatSeconds / ActiveSeconds) : 0.f;
	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		Telemetry->RecordRealmPacing(static_cast<float>(ActiveSeconds), CombatShare);
	}
	UE_LOG(LogEnder, Log, TEXT("Realm ended (%s) after %.0f s, combat %.0f%% (target ≈70%%), first-completion target %s"), *Outcome, ActiveSeconds,
		CombatShare * 100.f, (ActiveSeconds >= EnderRules::RealmFlow::FirstCompletionMin && ActiveSeconds <= EnderRules::RealmFlow::FirstCompletionMax) ? TEXT("met") : TEXT("missed"));

	UEnderRealityClient* Client = UEnderRealityClient::Get(this);
	if (Client)
	{
		Client->SetRealmActive(false);
		TArray<int32> Rooms = ClearedServiceRooms;
		if (Outcome != TEXT("victory"))
		{
			Rooms.Remove(EnderRules::RealmFlow::ServiceRoomIndex(EnderRules::ERealmSegment::Boss));
		}
		Rooms.Sort();
		Client->CompleteRun(Outcome, Rooms, Kills, ActiveSeconds, Deaths, BossPhaseSeconds);
	}

	UEnderInventoryComponent* Inventory = UEnderInventoryComponent::FindFor(UGameplayStatics::GetPlayerPawn(this, 0));
	if (Inventory)
	{
		Inventory->Persist();
	}
	if (Client && Inventory)
	{
		Client->ReplayDeferred([Inventory](const FGuid& FormId)
		{
			FEnderForm Form;
			return Inventory->GetForm(FormId, Form) ? Form.ArtifactId : FString();
		});
	}
	if (UEnderSaveSubsystem* SaveSys = UEnderSaveSubsystem::Get(this))
	{
		if (UEnderSaveGame* Save = SaveSys->GetSave())
		{
			if (Outcome == TEXT("victory"))
			{
				Save->bTutorialComplete = true;
				++Save->RealmsCompleted;
			}
		}
		SaveSys->SaveNow();
	}
	OnRealmEnded.Broadcast(Outcome);
}

// ------------------------------------------------------------------ Focus / shrine

bool UEnderRealmSubsystem::TrySpendFocus(EEnderFamiliarAction Action)
{
	if (!Focus.TrySpend(EnderConvert::ToRules(Action)))
	{
		return false;
	}
	OnFocusChanged.Broadcast(Focus.Current, Focus.Max);
	return true;
}

bool UEnderRealmSubsystem::AttuneAtShrine(APawn* Binder, const FGuid& FormId, TArray<FText>& OutFamiliarLines)
{
	const UEnderRealityClient* Client = UEnderRealityClient::Get(this);
	if (!bActive || (Client && Client->IsInCombat()) || !CanAfford(EEnderFamiliarAction::Attune))
	{
		return false;
	}
	UEnderInventoryComponent* Inventory = UEnderInventoryComponent::FindFor(Binder);
	if (!Inventory || !Inventory->AttuneLocally(FormId, OutFamiliarLines))
	{
		return false;
	}
	TrySpendFocus(EEnderFamiliarAction::Attune);
	if (UEnderRealityClient* MutableClient = UEnderRealityClient::Get(this))
	{
		MutableClient->QueueDeferred(TEXT("POST"), TEXT("/attune"), TEXT("{\"artifactId\":\"{artifact}\"}"), FormId);
	}
	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		FEnderForm Form;
		Inventory->GetForm(FormId, Form);
		Telemetry->RecordFormInspected(Form.CandidateId);
	}
	return true;
}
