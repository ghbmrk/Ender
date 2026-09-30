#include "Items/EnderLootSubsystem.h"

#include "Combat/EnderRunRandomSubsystem.h"
#include "Ender.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Inventory/EnderInventoryComponent.h"
#include "Items/EnderLootDrop.h"
#include "Items/EnderLootProfile.h"
#include "Kismet/GameplayStatics.h"
#include "Reality/EnderRealityClient.h"
#include "Rules/RealmFlowRules.h"
#include "Telemetry/EnderTelemetrySubsystem.h"

#define LOCTEXT_NAMESPACE "EnderLoot"

UEnderLootSubsystem* UEnderLootSubsystem::Get(const UObject* WorldContext)
{
	const UWorld* W = WorldContext ? WorldContext->GetWorld() : nullptr;
	return W ? W->GetSubsystem<UEnderLootSubsystem>() : nullptr;
}

void UEnderLootSubsystem::BeginRealm(const FEnderRealmPrefetch& Prefetch, UEnderLootProfile* InProfile)
{
	Realm = Prefetch;
	Profile = InProfile;
	EssenceCounter = EnderRules::FEssenceDropCounter();
	RoomBias = EnderRules::FFormBias();
	RealmBias = EnderRules::FFormBias();

	PoolViews.clear();
	PoolViews.reserve(Realm.CandidatePool.Num());
	for (int32 I = 0; I < Realm.CandidatePool.Num(); ++I)
	{
		const FEnderCandidate& C = Realm.CandidatePool[I];
		EnderRules::FCandidateView V;
		V.Index = I;
		for (int32 Q = 0; Q < EnderRules::NumQualities; ++Q)
		{
			V.Qualities[Q] = C.Qualities.IsValidIndex(Q) ? C.Qualities[Q] : 0.0;
		}
		V.TechnicalPercentile = C.TechnicalPercentile;
		PoolViews.push_back(V);
	}
}

void UEnderLootSubsystem::BeginRoom()
{
	RoomBias = EnderRules::FFormBias();
}

EnderRules::FRunRandom& UEnderLootSubsystem::LootRng()
{
	if (UEnderRunRandomSubsystem* Run = GetWorld()->GetSubsystem<UEnderRunRandomSubsystem>())
	{
		return Run->Stream(EnderRules::Stream::Loot);
	}
	return FallbackRng;
}

float UEnderLootSubsystem::CharmBonus() const
{
	const APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
	const UEnderInventoryComponent* Inventory = UEnderInventoryComponent::FindFor(Player);
	return Inventory ? Inventory->GetLootPercentileBonus() : 0.f;
}

FVector UEnderLootSubsystem::Scatter(const FVector& Around) const
{
	// Presentation only: not drawn from the Loot stream so it can never shift a roll.
	const float Radius = Profile ? Profile->ScatterRadius : 140.f;
	const FVector2D Offset = FMath::RandPointInCircle(Radius);
	const FVector Start = Around + FVector(Offset.X, Offset.Y, 150.f);
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(EnderLootGround), false);
	if (GetWorld()->LineTraceSingleByChannel(Hit, Start, Start - FVector(0.f, 0.f, 600.f), ECC_WorldStatic, Params))
	{
		return Hit.ImpactPoint + FVector(0.f, 0.f, 20.f);
	}
	return Around + FVector(Offset.X, Offset.Y, 0.f);
}

FText UEnderLootSubsystem::OrdinaryName(EEnderGearSlot Slot) const
{
	const int32 I = static_cast<int32>(Slot);
	if (Profile && Profile->OrdinaryNames.IsValidIndex(I))
	{
		return Profile->OrdinaryNames[I];
	}
	switch (Slot)
	{
	case EEnderGearSlot::Blade: return LOCTEXT("WornBlade", "Worn Blade");
	case EEnderGearSlot::Ward: return LOCTEXT("IronWard", "Iron Ward");
	case EEnderGearSlot::Sigil: return LOCTEXT("ChalkSigil", "Chalk Sigil");
	case EEnderGearSlot::Charm: return LOCTEXT("BoneCharm", "Bone Charm");
	}
	return FText::GetEmpty();
}

void UEnderLootSubsystem::NotifyEnemyKilled(EEnderArchetype Archetype, bool bElite, FVector Location)
{
	if (Archetype != EEnderArchetype::BoundKing)
	{
		const EnderRules::EArchetype A = EnderConvert::ToRules(Archetype);
		RoomBias.AddKill(A, bElite ? 3.0 : 1.0);
		RealmBias.AddKill(A, bElite ? 3.0 : 1.0);
	}
	if (bElite || Archetype == EEnderArchetype::BoundKing)
	{
		return;
	}
	if (EssenceCounter.OnNormalKill(LootRng()))
	{
		EnderRules::FRunRandom& Rng = LootRng();
		// Which Essence: the Realm's drop weights (preload.realm.essenceDrops).
		float Total = 0.f;
		for (const FEnderEssenceWeight& W : Realm.EssenceDrops) Total += W.Weight;
		EEnderEssence Essence = EEnderEssence::Ember;
		double Roll = Rng.NextUnit() * Total;
		for (const FEnderEssenceWeight& W : Realm.EssenceDrops)
		{
			Essence = W.Essence;
			Roll -= W.Weight;
			if (Roll <= 0.0) break;
		}
		FEnderLootPayload Payload;
		Payload.Kind = EEnderLootKind::Essence;
		Payload.Essence.Essence = Essence;
		Payload.Essence.Quantity = Rng.RangeInt(Profile ? Profile->EssenceBundleMin : 2, Profile ? Profile->EssenceBundleMax : 4);
		SpawnDrop(Payload, Location);
	}
}

FEnderForm UEnderLootSubsystem::RollForm(EEnderDropSource Source, bool bEliteRoll, const EnderRules::FFormBias& Bias)
{
	EnderRules::FRunRandom& Rng = LootRng();
	FEnderForm Form;
	Form.Id = FGuid::NewGuid();
	Form.RealmId = Realm.RealmId;
	Form.DropSource = Source;
	Form.Qualities.Init(0.f, EnderNumQualities);

	const int32 Picked = Realm.bOffline || PoolViews.empty()
		? -1
		: EnderRules::ChooseCandidate(PoolViews, Bias, CharmBonus(), Realm.DiscoveryPercentileBonus, bEliteRoll, Rng);

	if (Picked < 0 || !Realm.CandidatePool.IsValidIndex(Picked))
	{
		// Offline fallback: an ordinary item. The Realm plays the same; only the reality layer is missing.
		const EnderRules::EDropSource RulesSource = EnderConvert::ToRules(Source);
		Form.bOrdinary = true;
		Form.OrdinaryPower = FMath::RoundToFloat(static_cast<float>(EnderRules::OrdinaryLoot::RollPower(RulesSource, Rng)));
		Form.OrdinarySlot = static_cast<EEnderGearSlot>(EnderRules::OrdinaryLoot::RollSlot(Rng));
		Form.FantasyName = OrdinaryName(Form.OrdinarySlot);
		Form.EvidenceTier = EEnderEvidenceTier::Trialed;
		return Form;
	}

	const FEnderCandidate& C = Realm.CandidatePool[Picked];
	Form.CandidateId = C.Id;
	Form.FantasyName = C.Name;
	Form.Qualities = C.Qualities;
	Form.Recipe = C.Recipe;
	Form.ProductionCost = C.ProductionCost;
	Form.TechnicalScore = C.TechnicalScore;
	Form.EvidenceTier = EEnderEvidenceTier::Veiled;
	Form.DevProvenance = C.DevProvenance;
	// A Veiled Form shows the quality its hunters leaned toward, so farming is legible.
	int32 Lean = -1;
	double Best = 0.0;
	for (int32 Q = 0; Q < EnderRules::NumQualities; ++Q)
	{
		if (Bias.Weight[Q] > Best)
		{
			Best = Bias.Weight[Q];
			Lean = Q;
		}
	}
	Form.RevealQuality(static_cast<EEnderQuality>(Lean >= 0 ? Lean : Rng.RangeInt(0, EnderRules::NumQualities - 1)));
	return Form;
}

void UEnderLootSubsystem::DropForms(int32 Count, EEnderDropSource Source, bool bEliteRoll, const EnderRules::FFormBias& Bias, const FVector& Location,
	int32 ServiceRoomIndex)
{
	UEnderRealityClient* Client = UEnderRealityClient::Get(this);
	for (int32 I = 0; I < Count; ++I)
	{
		FEnderLootPayload Payload;
		Payload.Kind = EEnderLootKind::Form;
		Payload.Form = RollForm(Source, bEliteRoll, Bias);
		Payload.Rarity = Payload.Form.bOrdinary ? EnderItems::RarityForPower(Payload.Form.OrdinaryPower)
			: EnderItems::RarityForPower(static_cast<float>(EnderRules::ArtifactPower(Payload.Form.TechnicalScore, EnderRules::EEvidenceTier::Trialed)));
		if (Client && !Payload.Form.bOrdinary)
		{
			Client->RecordFormDrop(ServiceRoomIndex, Payload.Form.CandidateId);
		}
		SpawnDrop(Payload, Location);
	}
}

void UEnderLootSubsystem::DropRoomRewards(EEnderRoomKind Room, FVector Location, bool bTutorial, int32 ServiceRoomIndex)
{
	const EnderRules::EDropSource Source = EnderRules::RealmFlow::DropSourceFor(EnderConvert::ToRules(Room));
	const bool bElite = Room == EEnderRoomKind::Elite;
	const int32 Forms = EnderRules::Loot::VeiledFormsFor(Source, bTutorial, LootRng());
	// Room clears use the room's own kills; an empty tally (e.g. scripted room) falls back to the Realm's.
	const EnderRules::FFormBias& Bias = RoomBias.Total() > 0 ? RoomBias : RealmBias;
	DropForms(Forms, static_cast<EEnderDropSource>(Source), bElite, Bias, Location, ServiceRoomIndex);

	const int32 Crowns = Profile ? Profile->RoomClearCrowns : 12;
	if (Room != EEnderRoomKind::Room1 && Crowns > 0)
	{
		FEnderLootPayload Payload;
		Payload.Kind = EEnderLootKind::Crowns;
		Payload.Crowns = bElite ? Crowns * 2 : Crowns;
		SpawnDrop(Payload, Location);
	}
}

void UEnderLootSubsystem::DropBossRewards(FVector Location, int32 ServiceRoomIndex)
{
	DropForms(EnderRules::Loot::VeiledFormsFor(EnderRules::EDropSource::Boss, false, LootRng()), EEnderDropSource::Boss, true, RealmBias, Location,
		ServiceRoomIndex);
	FEnderLootPayload Payload;
	Payload.Kind = EEnderLootKind::Crowns;
	Payload.Crowns = Profile ? Profile->BossCrowns : 60;
	SpawnDrop(Payload, Location);
}

AEnderLootDrop* UEnderLootSubsystem::SpawnDrop(const FEnderLootPayload& Payload, const FVector& Location)
{
	UWorld* World = GetWorld();
	TSubclassOf<AEnderLootDrop> Class = Profile && Profile->LootDropClass ? Profile->LootDropClass : TSubclassOf<AEnderLootDrop>(AEnderLootDrop::StaticClass());
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AEnderLootDrop* Drop = World->SpawnActor<AEnderLootDrop>(Class, FTransform(Scatter(Location)), Params);
	if (!Drop)
	{
		return nullptr;
	}
	Drop->InitializeLoot(Payload);
	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		Telemetry->RecordLootDropped(Payload.Kind);
	}
	OnLootDropped.Broadcast(Drop);
	return Drop;
}

void UEnderLootSubsystem::SetLabelsVisible(bool bVisible)
{
	bLabelsVisible = bVisible;
	for (const TWeakObjectPtr<AEnderLootDrop>& D : Drops)
	{
		if (AEnderLootDrop* Drop = D.Get())
		{
			Drop->SetLabelVisible(bVisible);
		}
	}
	OnLootLabelsChanged.Broadcast(bVisible);
}

void UEnderLootSubsystem::RegisterDrop(AEnderLootDrop* Drop)
{
	Drops.RemoveAll([](const TWeakObjectPtr<AEnderLootDrop>& D) { return !D.IsValid(); });
	Drops.AddUnique(Drop);
}

void UEnderLootSubsystem::UnregisterDrop(AEnderLootDrop* Drop)
{
	Drops.Remove(Drop);
}

#undef LOCTEXT_NAMESPACE
