#include "Reality/EnderRealityClient.h"

#include "Ender.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GenericPlatform/GenericPlatformHttp.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Reality/EnderRealityJson.h"
#include "Reality/EnderRealitySettings.h"
#include "Rules/RealmFlowRules.h"

struct FEnderPrefetchJob
{
	FString RealmId;
	bool bTutorial = false;
	int32 Outstanding = 0;
	bool bFailed = false;
	FEnderRealmPrefetch Data;
	FEnderOnPrefetchNative OnDone;
};

namespace
{
	using FJsonArray = TArray<TSharedPtr<FJsonValue>>;

	const TCHAR* const VerbGet = TEXT("GET");
	const TCHAR* const VerbPost = TEXT("POST");

	FString Enc(const FString& S) { return FGenericPlatformHttp::UrlEncode(S); }

	TSharedPtr<FJsonObject> NewBody() { return MakeShared<FJsonObject>(); }

	FJsonArray NumberArray(const TArray<int32>& Values)
	{
		FJsonArray Out;
		for (int32 V : Values) Out.Add(MakeShared<FJsonValueNumber>(V));
		return Out;
	}

	const FJsonObject* ObjField(const TSharedPtr<FJsonObject>& J, const TCHAR* Key)
	{
		const TSharedPtr<FJsonObject>* P = nullptr;
		return J.IsValid() && J->TryGetObjectField(Key, P) && P && P->IsValid() ? P->Get() : nullptr;
	}

	FString ErrorOf(const TSharedPtr<FJsonObject>& J, int32 Status)
	{
		FString Message;
		if (J.IsValid() && J->TryGetStringField(TEXT("error"), Message)) return Message;
		if (J.IsValid() && J->TryGetStringField(TEXT("message"), Message)) return Message;
		return Status > 0 ? FString::Printf(TEXT("HTTP %d"), Status) : TEXT("The reality service could not be reached.");
	}

	/** Prophecy probabilities must serialise exactly (the service validates literals). */
	constexpr double ProphecyProbabilities[5] = {0.1, 0.3, 0.5, 0.7, 0.9};
}

UEnderRealityClient* UEnderRealityClient::Get(const UObject* WorldContext)
{
	const UWorld* W = GEngine ? GEngine->GetWorldFromContextObject(WorldContext, EGetWorldErrorMode::ReturnNull) : nullptr;
	const UGameInstance* GI = W ? W->GetGameInstance() : nullptr;
	return GI ? GI->GetSubsystem<UEnderRealityClient>() : nullptr;
}

void UEnderRealityClient::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	UE_LOG(LogEnder, Log, TEXT("Reality client → %s (timeout %.1fs, offline fallback %s)"), *UEnderRealitySettings::Get()->ServiceBaseUrl,
		UEnderRealitySettings::Get()->RequestTimeoutSeconds, UEnderRealitySettings::Get()->bAllowOfflineFallback ? TEXT("on") : TEXT("off"));
}

void UEnderRealityClient::Deinitialize()
{
	OnArtifactsBanked.Clear();
	Super::Deinitialize();
}

// ------------------------------------------------------------------ gates

void UEnderRealityClient::SetRealmActive(bool bActive)
{
	bRealmActive = bActive;
	if (!bActive)
	{
		bInCombat = false;
	}
}

void UEnderRealityClient::SetInCombat(bool bNewInCombat)
{
	bInCombat = bNewInCombat;
}

bool UEnderRealityClient::GateRequest(const FString& Path, bool bRunCheckpoint)
{
	if (bRealmActive && !bRunCheckpoint)
	{
		UE_LOG(LogEnder, Warning, TEXT("Reality request refused while a Realm is active: %s"), *Path);
		OnRequestRefused.Broadcast(Path);
		return false;
	}
	if (bRunCheckpoint && bInCombat)
	{
		UE_LOG(LogEnder, Warning, TEXT("Run checkpoint held: combat is live (%s)"), *Path);
		return false;
	}
	return true;
}

void UEnderRealityClient::SetServiceReachable(bool bReachable)
{
	if (bServiceReachable != bReachable)
	{
		bServiceReachable = bReachable;
		UE_LOG(LogEnder, Log, TEXT("Reality service %s"), bReachable ? TEXT("reachable") : TEXT("unreachable"));
		OnServiceStatusChanged.Broadcast(bReachable);
	}
}

void UEnderRealityClient::SendRequest(const FString& Verb, const FString& Path, const TSharedPtr<FJsonObject>& Body, FEnderRealityJsonCallback OnDone)
{
	if (!GateRequest(Path, false))
	{
		OnDone.ExecuteIfBound(false, 0, nullptr);
		return;
	}
	Dispatch(Verb, Path, Body.IsValid() ? EnderRealityJson::ToString(Body.ToSharedRef()) : FString(), OnDone);
}

void UEnderRealityClient::Dispatch(const FString& Verb, const FString& Path, const FString& Body, FEnderRealityJsonCallback OnDone)
{
	const UEnderRealitySettings* Settings = UEnderRealitySettings::Get();
	FString Base = Settings->ServiceBaseUrl;
	Base.RemoveFromEnd(TEXT("/"));

	const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Base + Path);
	Request->SetVerb(Verb);
	Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
	if (Verb != VerbGet)
	{
		// Fastify rejects an empty JSON body, so POSTs always carry at least {}.
		Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
		Request->SetContentAsString(Body.IsEmpty() ? FString(TEXT("{}")) : Body);
	}
	Request->SetTimeout(Settings->RequestTimeoutSeconds);

	TWeakObjectPtr<UEnderRealityClient> WeakThis(this);
	Request->OnProcessRequestComplete().BindLambda(
		[WeakThis, Path, OnDone](FHttpRequestPtr, FHttpResponsePtr Response, bool bConnected)
		{
			UEnderRealityClient* Self = WeakThis.Get();
			if (!Self)
			{
				return;
			}
			const int32 Status = Response.IsValid() ? Response->GetResponseCode() : 0;
			TSharedPtr<FJsonObject> Json;
			if (Response.IsValid())
			{
				Json = EnderRealityJson::Parse(Response->GetContentAsString());
			}
			Self->SetServiceReachable(bConnected && Response.IsValid());
			const bool bOk = bConnected && Response.IsValid() && EHttpResponseCodes::IsOk(Status) && Json.IsValid();
			if (!bOk)
			{
				UE_LOG(LogEnder, Warning, TEXT("Reality %s failed: %s"), *Path, *ErrorOf(Json, Status));
			}
			OnDone.ExecuteIfBound(bOk, Status, Json);
		});
	Request->ProcessRequest();
}

// ------------------------------------------------------------------ prefetch

void UEnderRealityClient::PrefetchRealm(const FString& RealmId, bool bTutorial)
{
	PrefetchRealmNative(RealmId, bTutorial, FEnderOnPrefetchNative());
}

void UEnderRealityClient::PrefetchRealmNative(const FString& RealmId, bool bTutorial, FEnderOnPrefetchNative OnDone)
{
	if (bRealmActive)
	{
		UE_LOG(LogEnder, Warning, TEXT("PrefetchRealm refused: a Realm is already active"));
		OnRequestRefused.Broadcast(TEXT("/realm/") + RealmId);
		OnDone.ExecuteIfBound(false, FEnderRealmPrefetch());
		return;
	}
	if (bPrefetchInFlight)
	{
		UE_LOG(LogEnder, Warning, TEXT("PrefetchRealm ignored: a prefetch is already in flight"));
		return;
	}
	bPrefetchInFlight = true;

	const TSharedRef<FEnderPrefetchJob> Job = MakeShared<FEnderPrefetchJob>();
	Job->RealmId = RealmId;
	Job->bTutorial = bTutorial;
	Job->Data.RealmId = RealmId;
	Job->Data.bTutorial = bTutorial;
	Job->OnDone = OnDone;
	BeginPrefetchReads(Job);
}

void UEnderRealityClient::BeginPrefetchReads(const TSharedRef<FEnderPrefetchJob>& Job)
{
	Job->Outstanding = 5;

	auto Read = [this, Job](const FString& Path, bool bRequired, TFunction<void(const FJsonObject&)> Apply)
	{
		Dispatch(VerbGet, Path, FString(), FEnderRealityJsonCallback::CreateWeakLambda(this,
			[this, Job, bRequired, Apply = MoveTemp(Apply)](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
			{
				if (bOk && Json.IsValid())
				{
					Apply(*Json);
				}
				else if (bRequired)
				{
					Job->bFailed = true;
				}
				PrefetchReadDone(Job);
			}));
	};

	Read(TEXT("/world"), true, [Job](const FJsonObject& J) { EnderRealityJson::ParseWorld(J, Job->Data.World); });
	Read(TEXT("/realm/") + Enc(Job->RealmId), true, [Job](const FJsonObject& J) { EnderRealityJson::ParseRealmView(J, Job->Data); });
	Read(TEXT("/contracts"), false, [Job](const FJsonObject& J) { EnderRealityJson::ParseContracts(J, Job->Data.Contracts); });
	Read(TEXT("/api/character"), false, [this, Job](const FJsonObject& J)
	{
		EnderRealityJson::ParseCharacter(J, Character);
		Job->Data.DiscoveryPercentileBonus = FMath::Min(15.f, Character.Mastery.DiscoveryPercentile);
	});

	Read(TEXT("/realm/") + Enc(Job->RealmId) + TEXT("/pool"), true, [Job](const FJsonObject& J)
	{
		EnderRealityJson::ParseRealmPool(J, Job->Data.CandidatePool);
	});
}

void UEnderRealityClient::PrefetchReadDone(const TSharedRef<FEnderPrefetchJob>& Job)
{
	if (--Job->Outstanding > 0)
	{
		return;
	}
	if (Job->bFailed)
	{
		FinishPrefetch(Job, false);
		return;
	}
	// Reads succeeded: start the run last, since it changes service state (Focus, run record).
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("realmId"), Job->RealmId);
	Dispatch(VerbPost, TEXT("/api/runs"), EnderRealityJson::ToString(Body.ToSharedRef()), FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this, Job](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk && Json.IsValid())
			{
				EnderRealityJson::ParseRunStart(*Json, Job->Data.Run);
			}
			FinishPrefetch(Job, bOk && Job->Data.Run.bValid);
		}));
}

void UEnderRealityClient::FinishPrefetch(const TSharedRef<FEnderPrefetchJob>& Job, bool bOnline)
{
	bPrefetchInFlight = false;
	ClearedServiceRooms.Reset();
	PendingCheckpointRooms.Reset();
	FormDropsByRoom.Reset();

	FEnderRealmPrefetch& Data = Job->Data;
	if (bOnline)
	{
		// Technical percentile within this Realm's pool: what Charm and Discovery Mastery push toward.
		std::vector<double> Scores;
		Scores.reserve(Data.CandidatePool.Num());
		for (const FEnderCandidate& C : Data.CandidatePool) Scores.push_back(C.TechnicalScore);
		const std::vector<double> Ranks = EnderRules::FormPool::PercentileRanks(Scores);
		for (int32 I = 0; I < Data.CandidatePool.Num(); ++I)
		{
			Data.CandidatePool[I].TechnicalPercentile = static_cast<float>(Ranks[I]);
		}
		Data.RunSeed = static_cast<int64>(EnderRules::FormPool::SeedFromString(TCHAR_TO_UTF8(*Data.Run.SeedString)));
		Data.Focus = Data.Run.Focus;
		Data.bOffline = false;
		Data.bValid = true;
		Data.PrefetchedAt = FDateTime::UtcNow();
		if (Data.CandidatePool.Num() == 0)
		{
			UE_LOG(LogEnder, Warning, TEXT("Prefetch for %s returned an empty Form pool; Veiled drops will be ordinary loot"), *Data.RealmId);
		}
		World = Data.World;
		Contracts = Data.Contracts;
		OnWorldStateUpdated.Broadcast(World);
		OnContractsUpdated.Broadcast(Contracts);
	}
	else if (UEnderRealitySettings::Get()->bAllowOfflineFallback)
	{
		UE_LOG(LogEnder, Warning, TEXT("Reality service unavailable: %s will play with ordinary loot"), *Job->RealmId);
		Data = MakeOfflinePrefetch(Job->RealmId, Job->bTutorial);
	}
	else
	{
		UE_LOG(LogEnder, Error, TEXT("Prefetch for %s failed and offline fallback is disabled"), *Job->RealmId);
		Job->OnDone.ExecuteIfBound(false, FEnderRealmPrefetch());
		OnRealmPrefetched.Broadcast(false, FEnderRealmPrefetch());
		return;
	}

	ActivePrefetch = Data;
	UE_LOG(LogEnder, Log, TEXT("Realm %s prefetched (%s): %d Forms in pool, seed %lld"), *Data.RealmId,
		Data.bOffline ? TEXT("offline") : TEXT("online"), Data.CandidatePool.Num(), Data.RunSeed);
	Job->OnDone.ExecuteIfBound(!Data.bOffline, ActivePrefetch);
	OnRealmPrefetched.Broadcast(!Data.bOffline, ActivePrefetch);
}

FEnderRealmPrefetch UEnderRealityClient::MakeOfflinePrefetch(const FString& RealmId, bool bTutorial) const
{
	FEnderRealmPrefetch Out;
	Out.bValid = true;
	Out.bOffline = true;
	Out.RealmId = RealmId;
	Out.bTutorial = bTutorial;
	Out.Focus = EnderRules::Focus::PerRealm;
	const FString SeedText = FString::Printf(TEXT("offline:%s:%llu"), *RealmId, static_cast<unsigned long long>(FDateTime::UtcNow().GetTicks()));
	Out.RunSeed = static_cast<int64>(EnderRules::FormPool::SeedFromString(TCHAR_TO_UTF8(*SeedText)));
	Out.PrefetchedAt = FDateTime::UtcNow();
	for (int32 E = 0; E < EnderNumEssences; ++E)
	{
		Out.EssenceDrops.Add({static_cast<EEnderEssence>(E), 1.f});
	}
	return Out;
}

void UEnderRealityClient::ClearPrefetch()
{
	ActivePrefetch = FEnderRealmPrefetch();
	ClearedServiceRooms.Reset();
	PendingCheckpointRooms.Reset();
	FormDropsByRoom.Reset();
}

// ------------------------------------------------------------------ run

void UEnderRealityClient::RecordFormDrop(int32 ServiceRoomIndex, const FString& CandidateId)
{
	if (!CandidateId.IsEmpty() && ServiceRoomIndex >= 0)
	{
		FormDropsByRoom.FindOrAdd(ServiceRoomIndex).Add(CandidateId);
	}
}

void UEnderRealityClient::QueueRunCheckpoint(int32 ServiceRoomIndex)
{
	if (ServiceRoomIndex >= 0)
	{
		ClearedServiceRooms.Add(ServiceRoomIndex);
		PendingCheckpointRooms.Add(ServiceRoomIndex);
	}
}

void UEnderRealityClient::FlushRunCheckpoints()
{
	if (ActivePrefetch.bOffline || !ActivePrefetch.Run.bValid)
	{
		PendingCheckpointRooms.Reset();
		return;
	}
	if (PendingCheckpointRooms.Num() == 0)
	{
		return;
	}
	const FString Path = FString::Printf(TEXT("/api/runs/%s/checkpoint"), *Enc(ActivePrefetch.Run.RunId));
	if (!GateRequest(Path, true))
	{
		return; // stays queued until the fight ends
	}

	TArray<int32> Rooms = ClearedServiceRooms.Array();
	Rooms.Sort();
	// The boss room (7) is banked only by CompleteRun on victory.
	Rooms.RemoveAll([](int32 R) { return R >= 7; });

	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetArrayField(TEXT("roomsCleared"), NumberArray(Rooms));
	// Which pool Forms dropped, so the service can bank the same Forms the player saw.
	FJsonArray Forms;
	for (int32 R : Rooms)
	{
		if (const TArray<FString>* Ids = FormDropsByRoom.Find(R))
		{
			for (const FString& Id : *Ids)
			{
				const TSharedPtr<FJsonObject> F = NewBody();
				F->SetNumberField(TEXT("room"), R);
				F->SetStringField(TEXT("candidateId"), Id);
				Forms.Add(MakeShared<FJsonValueObject>(F));
			}
		}
	}
	Body->SetArrayField(TEXT("forms"), Forms);
	PendingCheckpointRooms.Reset();

	// Fire and forget: gameplay never waits for this.
	Dispatch(VerbPost, Path, EnderRealityJson::ToString(Body.ToSharedRef()), FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				BroadcastBanked(Json, TEXT("artifacts"));
			}
		}));
}

void UEnderRealityClient::CompleteRun(const FString& Outcome, const TArray<int32>& RoomsCleared, const TMap<FString, int32>& Kills,
	double DurationSeconds, int32 Deaths, const TArray<double>& BossPhaseSeconds)
{
	if (ActivePrefetch.bOffline || !ActivePrefetch.Run.bValid)
	{
		return;
	}
	const FString Path = FString::Printf(TEXT("/api/runs/%s/complete"), *Enc(ActivePrefetch.Run.RunId));
	if (!GateRequest(Path, false))
	{
		return;
	}
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("outcome"), Outcome);
	Body->SetArrayField(TEXT("roomsCleared"), NumberArray(RoomsCleared));
	const TSharedPtr<FJsonObject> KillsJson = NewBody();
	for (const TPair<FString, int32>& K : Kills) KillsJson->SetNumberField(K.Key, K.Value);
	Body->SetObjectField(TEXT("kills"), KillsJson);
	Body->SetNumberField(TEXT("durationMs"), FMath::RoundToDouble(DurationSeconds * 1000.0));
	Body->SetNumberField(TEXT("deaths"), Deaths);
	FJsonArray Phases;
	for (double S : BossPhaseSeconds) Phases.Add(MakeShared<FJsonValueNumber>(FMath::RoundToDouble(S * 1000.0)));
	Body->SetArrayField(TEXT("bossPhaseMs"), Phases);
	FJsonArray Forms;
	for (const TPair<int32, TArray<FString>>& Room : FormDropsByRoom)
	{
		for (const FString& Id : Room.Value)
		{
			const TSharedPtr<FJsonObject> F = NewBody();
			F->SetNumberField(TEXT("room"), Room.Key);
			F->SetStringField(TEXT("candidateId"), Id);
			Forms.Add(MakeShared<FJsonValueObject>(F));
		}
	}
	Body->SetArrayField(TEXT("forms"), Forms);

	Dispatch(VerbPost, Path, EnderRealityJson::ToString(Body.ToSharedRef()), FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				BroadcastBanked(Json, TEXT("runArtifacts"));
			}
			RequestCharacter();
			RequestWorld();
		}));
}

void UEnderRealityClient::BroadcastBanked(const TSharedPtr<FJsonObject>& Json, const TCHAR* ArrayField)
{
	const FJsonArray* Items = nullptr;
	if (!Json.IsValid() || !Json->TryGetArrayField(ArrayField, Items) || !Items)
	{
		return;
	}
	TArray<FEnderForm> Banked;
	for (const TSharedPtr<FJsonValue>& V : *Items)
	{
		const TSharedPtr<FJsonObject>* O = nullptr;
		if (V.IsValid() && V->TryGetObject(O) && O && O->IsValid())
		{
			FEnderForm Form;
			EnderRealityJson::ParseArtifact(**O, Form);
			Banked.Add(Form);
		}
	}
	if (Banked.Num() > 0)
	{
		OnArtifactsBanked.Broadcast(Banked);
	}
}

void UEnderRealityClient::QueueDeferred(const FString& Verb, const FString& Path, const FString& Body, const FGuid& FormId)
{
	if (ActivePrefetch.bOffline)
	{
		return; // offline Realms keep crafting local
	}
	FEnderDeferredRequest& R = Deferred.AddDefaulted_GetRef();
	R.Verb = Verb;
	R.Path = Path;
	R.Body = Body;
	R.FormId = FormId;
}

void UEnderRealityClient::ReplayDeferred(TFunctionRef<FString(const FGuid&)> ResolveArtifactId)
{
	if (bRealmActive)
	{
		return;
	}
	TArray<FEnderDeferredRequest> Keep;
	for (const FEnderDeferredRequest& R : Deferred)
	{
		const bool bNeedsArtifact = R.Path.Contains(TEXT("{artifact}")) || R.Body.Contains(TEXT("{artifact}"));
		const FString ArtifactId = bNeedsArtifact ? ResolveArtifactId(R.FormId) : FString();
		if (bNeedsArtifact && ArtifactId.IsEmpty())
		{
			Keep.Add(R); // not banked yet; try again next time
			continue;
		}
		const FString Path = R.Path.Replace(TEXT("{artifact}"), *ArtifactId);
		const FString Body = R.Body.Replace(TEXT("{artifact}"), *ArtifactId);
		Dispatch(R.Verb, Path, Body, FEnderRealityJsonCallback::CreateWeakLambda(this,
			[this, ArtifactId](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
			{
				if (bOk)
				{
					HandleArtifactEnvelope(ArtifactId, Json);
				}
			}));
	}
	Deferred = MoveTemp(Keep);
}

// ------------------------------------------------------------------ reads

void UEnderRealityClient::RequestWorld()
{
	FetchWorld(FEnderOnWorldLoadedNative());
}

void UEnderRealityClient::FetchWorld(FEnderOnWorldLoadedNative OnDone)
{
	SendRequest(VerbGet, TEXT("/world"), nullptr, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this, OnDone](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				EnderRealityJson::ParseWorld(*Json, World);
				OnWorldStateUpdated.Broadcast(World);
			}
			OnDone.ExecuteIfBound(bOk, World);
		}));
}

void UEnderRealityClient::RequestRealmCard(const FString& RealmId)
{
	SendRequest(VerbGet, TEXT("/realm/") + Enc(RealmId), nullptr, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				FEnderRealmPrefetch View;
				EnderRealityJson::ParseRealmView(*Json, View);
				OnRealmCardLoaded.Broadcast(View.Card);
			}
		}));
}

void UEnderRealityClient::RequestBazaar()
{
	SendRequest(VerbGet, TEXT("/bazaar"), nullptr, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				FEnderBazaarState Bazaar;
				EnderRealityJson::ParseBazaar(*Json, Bazaar);
				Contracts = Bazaar.Contracts;
				OnBazaarUpdated.Broadcast(Bazaar);
				OnContractsUpdated.Broadcast(Contracts);
			}
		}));
}

void UEnderRealityClient::RequestContracts()
{
	SendRequest(VerbGet, TEXT("/contracts"), nullptr, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				EnderRealityJson::ParseContracts(*Json, Contracts);
				OnContractsUpdated.Broadcast(Contracts);
			}
		}));
}

void UEnderRealityClient::RequestCharacter()
{
	SendRequest(VerbGet, TEXT("/api/character"), nullptr, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				EnderRealityJson::ParseCharacter(*Json, Character);
				OnCharacterUpdated.Broadcast(Character);
			}
		}));
}

void UEnderRealityClient::RequestPassives()
{
	SendRequest(VerbGet, TEXT("/api/passives"), nullptr, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				FEnderPassiveTree Tree;
				EnderRealityJson::ParsePassives(*Json, Tree);
				OnPassivesUpdated.Broadcast(Tree);
			}
		}));
}

void UEnderRealityClient::RequestGrimoire()
{
	SendRequest(VerbGet, TEXT("/api/grimoire"), nullptr, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			if (!bOk)
			{
				return;
			}
			TMap<FString, FString> ParentOf;
			const FJsonArray* Lineage = nullptr;
			if (Json->TryGetArrayField(TEXT("lineage"), Lineage) && Lineage)
			{
				for (const TSharedPtr<FJsonValue>& V : *Lineage)
				{
					const TSharedPtr<FJsonObject>* O = nullptr;
					if (V.IsValid() && V->TryGetObject(O) && O && O->IsValid())
					{
						ParentOf.Add((*O)->GetStringField(TEXT("child_id")), (*O)->GetStringField(TEXT("parent_id")));
					}
				}
			}
			TArray<FEnderGrimoireEntry> Entries;
			const FJsonArray* Artifacts = nullptr;
			if (Json->TryGetArrayField(TEXT("artifacts"), Artifacts) && Artifacts)
			{
				for (const TSharedPtr<FJsonValue>& V : *Artifacts)
				{
					const TSharedPtr<FJsonObject>* O = nullptr;
					if (V.IsValid() && V->TryGetObject(O) && O && O->IsValid())
					{
						FEnderGrimoireEntry& E = Entries.AddDefaulted_GetRef();
						EnderRealityJson::ParseArtifact(**O, E.Form);
						(*O)->TryGetStringField(TEXT("origin"), E.Origin);
						(*O)->TryGetStringField(TEXT("status"), E.Status);
						if (const FString* Parent = ParentOf.Find(E.Form.ArtifactId)) E.ParentArtifactId = *Parent;
					}
				}
			}
			OnGrimoireLoaded.Broadcast(Entries);
		}));
}

FString UEnderRealityClient::CandidateQuery(const FString& RealmId) const
{
	FString Q;
	if (!RealmId.IsEmpty()) Q += TEXT("realm=") + Enc(RealmId);
	if (UEnderRealitySettings::Get()->bRequestDeveloperProvenance) Q += (Q.IsEmpty() ? TEXT("") : TEXT("&")) + FString(TEXT("provenance=1"));
	return Q.IsEmpty() ? Q : TEXT("?") + Q;
}

void UEnderRealityClient::FetchCandidate(const FString& CandidateId, const FString& RealmId, FEnderOnCandidateNative OnDone)
{
	SendRequest(VerbGet, TEXT("/candidate/") + Enc(CandidateId) + CandidateQuery(RealmId), nullptr, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[OnDone](bool bOk, int32, const TSharedPtr<FJsonObject>& Json)
		{
			FEnderCandidate C;
			if (bOk)
			{
				EnderRealityJson::ParseCandidate(*Json, C);
			}
			OnDone.ExecuteIfBound(bOk, C);
		}));
}

// ------------------------------------------------------------------ actions

void UEnderRealityClient::HandleArtifactEnvelope(const FString& ArtifactId, const TSharedPtr<FJsonObject>& Json)
{
	if (!Json.IsValid())
	{
		return;
	}
	FEnderInferenceUsage Usage;
	EnderRealityJson::ParseUsage(*Json, Usage);

	TArray<FText> Lines;
	if (const FJsonObject* Result = ObjField(Json, TEXT("result")))
	{
		FText Name, Epithet;
		EnderRealityJson::ParseAttuneResult(*Result, Name, Epithet, Lines);
	}
	const FJsonObject* Artifact = nullptr;
	if (const FJsonObject* Game = ObjField(Json, TEXT("game")))
	{
		const TSharedPtr<FJsonObject>* P = nullptr;
		Artifact = Game->TryGetObjectField(TEXT("artifact"), P) && P && P->IsValid() ? P->Get() : nullptr;
	}
	if (!Artifact)
	{
		Artifact = ObjField(Json, TEXT("artifact")); // /evaluate and /api/* shapes
	}
	if (Artifact)
	{
		FEnderForm Form;
		EnderRealityJson::ParseArtifact(*Artifact, Form);
		if (Lines.Num() == 0) Lines = Form.FamiliarLines;
		OnArtifactUpdated.Broadcast(Form, Lines, Usage);
	}
	else if (Lines.Num() > 0)
	{
		FEnderForm Form;
		Form.ArtifactId = ArtifactId;
		OnArtifactUpdated.Broadcast(Form, Lines, Usage);
	}
}

void UEnderRealityClient::Attune(const FString& ArtifactId)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("artifactId"), ArtifactId);
	SendRequest(VerbPost, TEXT("/attune"), Body, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this, ArtifactId](bool bOk, int32 Status, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk) HandleArtifactEnvelope(ArtifactId, Json);
			OnServiceAction.Broadcast(TEXT("attune"), bOk, bOk ? ArtifactId : ErrorOf(Json, Status));
		}));
}

void UEnderRealityClient::Evaluate(const FString& ArtifactId, const FString& Mode)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("artifactId"), ArtifactId);
	Body->SetStringField(TEXT("mode"), Mode);
	SendRequest(VerbPost, TEXT("/evaluate"), Body, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this, ArtifactId](bool bOk, int32 Status, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk) HandleArtifactEnvelope(ArtifactId, Json);
			OnServiceAction.Broadcast(TEXT("evaluate"), bOk, bOk ? ArtifactId : ErrorOf(Json, Status));
		}));
}

void UEnderRealityClient::Critique(const FString& ArtifactId, const FString& Mode)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("artifactId"), ArtifactId);
	Body->SetStringField(TEXT("mode"), Mode);
	SendRequest(VerbPost, TEXT("/critique"), Body, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this, ArtifactId](bool bOk, int32 Status, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				FEnderCritique Critique;
				if (const FJsonObject* Result = ObjField(Json, TEXT("result")))
				{
					EnderRealityJson::ParseCritique(*Result, Critique);
				}
				OnCritique.Broadcast(ArtifactId, Critique);
				HandleArtifactEnvelope(ArtifactId, Json);
			}
			OnServiceAction.Broadcast(TEXT("critique"), bOk, bOk ? ArtifactId : ErrorOf(Json, Status));
		}));
}

void UEnderRealityClient::RequestTemperOptions(const FString& ArtifactId)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("artifactId"), ArtifactId);
	SendRequest(VerbPost, TEXT("/transform"), Body, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this, ArtifactId](bool bOk, int32 Status, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk)
			{
				TArray<FEnderTemperChoice> Choices;
				FText Summary;
				if (const FJsonObject* Result = ObjField(Json, TEXT("result")))
				{
					EnderRealityJson::ParseTemperChoices(*Result, Choices, Summary);
				}
				OnTemperOptions.Broadcast(ArtifactId, Choices, Summary);
			}
			OnServiceAction.Broadcast(TEXT("temper-options"), bOk, bOk ? ArtifactId : ErrorOf(Json, Status));
		}));
}

void UEnderRealityClient::ChooseTemper(const FString& ArtifactId, const FString& CandidateId)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("choice"), CandidateId);
	SendRequest(VerbPost, FString::Printf(TEXT("/api/artifacts/%s/temper"), *Enc(ArtifactId)), Body, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this, ArtifactId](bool bOk, int32 Status, const TSharedPtr<FJsonObject>& Json)
		{
			if (bOk) HandleArtifactEnvelope(ArtifactId, Json);
			OnServiceAction.Broadcast(TEXT("temper"), bOk, bOk ? ArtifactId : ErrorOf(Json, Status));
		}));
}

void UEnderRealityClient::PostAction(const FString& Action, const FString& Path, const TSharedPtr<FJsonObject>& Body, bool bRefreshBazaar)
{
	SendRequest(VerbPost, Path, Body, FEnderRealityJsonCallback::CreateWeakLambda(this,
		[this, Action, bRefreshBazaar](bool bOk, int32 Status, const TSharedPtr<FJsonObject>& Json)
		{
			FString Message = bOk ? FString() : ErrorOf(Json, Status);
			if (bOk && Json.IsValid())
			{
				Json->TryGetStringField(TEXT("id"), Message);
				// Bought Forms arrive as an artifact; hand them to the inventory.
				if (const FJsonObject* Artifact = ObjField(Json, TEXT("artifact")))
				{
					FEnderForm Form;
					EnderRealityJson::ParseArtifact(*Artifact, Form);
					TArray<FEnderForm> Bought;
					Bought.Add(Form);
					OnArtifactsBanked.Broadcast(Bought);
				}
				if (const FJsonObject* CharacterJson = ObjField(Json, TEXT("character")))
				{
					EnderRealityJson::ParseCharacter(*CharacterJson, Character);
					OnCharacterUpdated.Broadcast(Character);
				}
			}
			OnServiceAction.Broadcast(Action, bOk, Message);
			if (bOk && bRefreshBazaar)
			{
				RequestBazaar();
			}
		}));
}

void UEnderRealityClient::Equip(EEnderGearSlot Slot, const FString& ArtifactId)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("slot"), EnderItems::SlotKey(Slot));
	if (ArtifactId.IsEmpty())
	{
		Body->SetField(TEXT("artifactId"), MakeShared<FJsonValueNull>());
	}
	else
	{
		Body->SetStringField(TEXT("artifactId"), ArtifactId);
	}
	PostAction(TEXT("equip"), TEXT("/api/equipment"), Body, false);
}

void UEnderRealityClient::AllocatePassive(const FString& NodeId)
{
	PostAction(TEXT("passive"), FString::Printf(TEXT("/api/passives/%s/allocate"), *Enc(NodeId)), NewBody(), false);
	RequestPassives();
}

void UEnderRealityClient::BuyEssence(EEnderEssence Essence, int32 Quantity)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("assetType"), TEXT("essence"));
	Body->SetStringField(TEXT("assetId"), EnderItems::EssenceKey(Essence));
	Body->SetNumberField(TEXT("quantity"), FMath::Max(1, Quantity));
	PostAction(TEXT("buy-essence"), TEXT("/api/bazaar/buy"), Body, true);
}

void UEnderRealityClient::SellEssence(EEnderEssence Essence, int32 Quantity)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("assetType"), TEXT("essence"));
	Body->SetStringField(TEXT("assetId"), EnderItems::EssenceKey(Essence));
	Body->SetNumberField(TEXT("quantity"), FMath::Max(1, Quantity));
	PostAction(TEXT("sell-essence"), TEXT("/api/bazaar/sell"), Body, true);
}

void UEnderRealityClient::BuyVeiledForm(const FString& OfferId)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("assetType"), TEXT("artifact"));
	Body->SetStringField(TEXT("assetId"), OfferId);
	PostAction(TEXT("buy-form"), TEXT("/api/bazaar/buy"), Body, true);
}

void UEnderRealityClient::SellForm(const FString& ArtifactId, bool bSalvage)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("assetType"), TEXT("artifact"));
	Body->SetStringField(TEXT("assetId"), ArtifactId);
	Body->SetStringField(TEXT("mode"), bSalvage ? TEXT("salvage") : TEXT("produce"));
	PostAction(TEXT("sell-form:") + ArtifactId, TEXT("/api/bazaar/sell"), Body, true);
}

void UEnderRealityClient::FulfilContract(const FString& ContractId, const FString& ArtifactId)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("artifactId"), ArtifactId);
	PostAction(TEXT("fulfil:") + ArtifactId, FString::Printf(TEXT("/api/contracts/%s/fulfill"), *Enc(ContractId)), Body, true);
}

void UEnderRealityClient::MakeProphecy(EEnderEssence Essence, int32 OptionIndex)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("essence"), EnderItems::EssenceKey(Essence));
	Body->SetNumberField(TEXT("probability"), ProphecyProbabilities[FMath::Clamp(OptionIndex, 0, 4)]);
	PostAction(TEXT("prophecy"), TEXT("/prophecy"), Body, true);
}

void UEnderRealityClient::ResolveProphecy(const FString& ProphecyId)
{
	const TSharedPtr<FJsonObject> Body = NewBody();
	Body->SetStringField(TEXT("id"), ProphecyId);
	PostAction(TEXT("prophecy-resolve"), TEXT("/prophecy/resolve"), Body, true);
}
