#include "Encounters/EnderEncounterDirector.h"

#include "AI/EnderEnemyCharacter.h"
#include "AI/EnderEnemyDefinition.h"
#include "Character/EnderPlayerCharacter.h"
#include "Combat/EnderRunRandomSubsystem.h"
#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Encounters/EnderEncounterDefinition.h"
#include "Encounters/EnderRealmSubsystem.h"
#include "Encounters/EnderSpawnPoint.h"
#include "Ender.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Items/EnderLootSubsystem.h"
#include "Kismet/GameplayStatics.h"
#include "NavigationSystem.h"
#include "Reality/EnderRealityClient.h"
#include "Rules/RealmFlowRules.h"
#include "Telemetry/EnderTelemetrySubsystem.h"

namespace
{
	EEnderRealmSegment SegmentFor(EEnderRoomKind Kind)
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

	constexpr int32 MaxPickTries = 24;
	constexpr float RetryDelay = 0.2f;
}

AEnderEncounterDirector::AEnderEncounterDirector()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = false;

	RoomTrigger = CreateDefaultSubobject<UBoxComponent>(TEXT("RoomTrigger"));
	RoomTrigger->InitBoxExtent(FVector(1100.f, 900.f, 200.f));
	RoomTrigger->SetCollisionProfileName(TEXT("Trigger"));
	RootComponent = RoomTrigger;

	CombatArea = CreateDefaultSubobject<UBoxComponent>(TEXT("CombatArea"));
	CombatArea->SetupAttachment(RoomTrigger);
	// Typical room: 2400 × 2000 cm.
	CombatArea->InitBoxExtent(FVector(1200.f, 1000.f, 150.f));
	CombatArea->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	CombatArea->ShapeColor = FColor(0x31, 0x5B, 0x57);
}

void AEnderEncounterDirector::BeginPlay()
{
	Super::BeginPlay();
	RoomTrigger->OnComponentBeginOverlap.AddDynamic(this, &ThisClass::HandleTriggerOverlap);
	SetDoorsLocked(false);
}

EEnderRoomKind AEnderEncounterDirector::GetRoomKind() const
{
	return Definition ? Definition->RoomKind : RoomKind;
}

float AEnderEncounterDirector::GetElapsed() const
{
	return State == EEnderEncounterState::Idle ? 0.f : static_cast<float>(GetWorld()->GetTimeSeconds() - StartedAt);
}

int32 AEnderEncounterDirector::GetAliveCount() const
{
	int32 N = Pending.Num();
	for (const FEnderLiveEnemy& L : Live) N += L.bDead ? 0 : 1;
	return N;
}

int32 AEnderEncounterDirector::ServiceRoomIndex() const
{
	return EnderRules::RealmFlow::ServiceRoomIndex(static_cast<EnderRules::ERealmSegment>(SegmentFor(GetRoomKind())));
}

FVector AEnderEncounterDirector::RoomCentre() const
{
	return CombatArea->GetComponentLocation() - FVector(0.f, 0.f, CombatArea->GetScaledBoxExtent().Z);
}

void AEnderEncounterDirector::HandleTriggerOverlap(UPrimitiveComponent*, AActor* OtherActor, UPrimitiveComponent*, int32, bool, const FHitResult&)
{
	const APawn* Pawn = Cast<APawn>(OtherActor);
	if (State == EEnderEncounterState::Idle && Pawn && Pawn->IsPlayerControlled())
	{
		StartEncounter();
	}
}

// ------------------------------------------------------------------ planning

const UEnderEnemyDefinition* AEnderEncounterDirector::ResolveDefinition(EEnderArchetype Archetype) const
{
	if (Definition)
	{
		if (const TObjectPtr<UEnderEnemyDefinition>* Found = Definition->EnemyDefinitions.Find(Archetype))
		{
			if (*Found) return Found->Get();
		}
	}
	const TObjectPtr<UEnderEnemyDefinition>* Found = EnemyDefinitions.Find(Archetype);
	return Found && *Found ? Found->Get() : nullptr;
}

EnderRules::FRoomRules AEnderEncounterDirector::BuildRules() const
{
	const bool bRoster = Definition ? Definition->bFirstRealmRoster : bFirstRealmRoster;
	EnderRules::FRoomRules R = EnderRules::RulesFor(EnderConvert::ToRules(GetRoomKind()), bRoster);
	for (int32 A = 0; A < EnderRules::NumArchetypes; ++A)
	{
		const EEnderArchetype Arch = static_cast<EEnderArchetype>(A);
		if (Definition && Definition->bOverrideAllowedArchetypes && !Definition->AllowedArchetypes.Contains(Arch))
		{
			R.Allowed[A] = false;
		}
		// Never plan an enemy the room cannot spawn.
		const UEnderEnemyDefinition* Def = ResolveDefinition(Arch);
		if (!Def || !Def->EnemyClass)
		{
			R.Allowed[A] = false;
		}
	}
	return R;
}

void AEnderEncounterDirector::StartEncounter()
{
	if (State != EEnderEncounterState::Idle)
	{
		return;
	}
	UEnderRealmSubsystem* Realm = GetWorld()->GetSubsystem<UEnderRealmSubsystem>();
	if (Realm && Realm->IsRealmActive() && !Realm->CanEnterSegment(SegmentFor(GetRoomKind())))
	{
		UE_LOG(LogEnder, Warning, TEXT("%s: room %s entered out of sequence; ignored"), *GetName(), *UEnum::GetValueAsString(GetRoomKind()));
		return;
	}

	State = EEnderEncounterState::Active;
	StartedAt = GetWorld()->GetTimeSeconds();
	SetActorTickEnabled(true);
	SetDoorsLocked(true);

	if (AEnderPlayerCharacter* Binder = Cast<AEnderPlayerCharacter>(UGameplayStatics::GetPlayerPawn(this, 0)))
	{
		Binder->ResetThreadForRoom();
	}
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->SetInCombat(true);
	}
	if (UEnderLootSubsystem* Loot = UEnderLootSubsystem::Get(this))
	{
		Loot->BeginRoom();
	}
	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		Telemetry->RecordRoomStarted(GetRoomKind());
	}
	if (Realm)
	{
		Realm->NotifyRoomStarted(this);
	}

	const EnderRules::FRoomRules Rules = BuildRules();
	UEnderRunRandomSubsystem* Run = GetWorld()->GetSubsystem<UEnderRunRandomSubsystem>();
	EnderRules::FRunRandom Fallback(0xE4C0u);
	EnderRules::FRunRandom& Stream = Run ? Run->Stream(EnderRules::Stream::Encounter) : Fallback;
	const int32 Offset = Definition ? Definition->SeedOffset : 0;
	if (Offset != 0)
	{
		// Still consumes exactly one draw from the Encounter stream, so the run stays reproducible.
		EnderRules::FRunRandom Local(Stream.NextU64() + static_cast<uint64>(Offset));
		Plan = EnderRules::PlanEncounter(Rules, Local);
	}
	else
	{
		Plan = EnderRules::PlanEncounter(Rules, Stream);
	}
	if (!EnderRules::PlanIsValid(Plan, Rules) || Plan.Enemies.empty())
	{
		UE_LOG(LogEnder, Warning, TEXT("%s: encounter plan is empty or invalid (missing enemy definitions?)"), *GetName());
	}
	UE_LOG(LogEnder, Log, TEXT("%s: %d enemies, %d/%d threat, %d roles"), *GetName(), static_cast<int32>(Plan.Enemies.size()), Plan.Spent, Rules.Budget, Plan.Roles());

	OpeningPopulation = 0;
	bReinforced = false;
	Pending.Reset();
	Live.Reset();
	QueueWave(0);
	OnRoomStarted.Broadcast(this, GetRoomKind());
}

void AEnderEncounterDirector::QueueWave(int32 Wave)
{
	for (const EnderRules::FPlannedEnemy& E : Plan.Enemies)
	{
		if (E.Wave != Wave)
		{
			continue;
		}
		FEnderPendingSpawn& P = Pending.AddDefaulted_GetRef();
		P.Archetype = EnderConvert::FromRules(E.Archetype);
		P.Elite = EnderConvert::FromRules(E.Elite);
		P.Wave = Wave;
		Telegraph(P);
		OpeningPopulation += Wave == 0 ? 1 : 0;
	}
	if (Wave == 1)
	{
		OnReinforcements();
	}
}

// ------------------------------------------------------------------ spawning

bool AEnderEncounterDirector::IsSpawnLegalNow(const FVector& Point) const
{
	const APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Player)
	{
		return true;
	}
	const FVector PL = Player->GetActorLocation();
	const FVector Face = Player->GetActorForwardVector().GetSafeNormal2D();
	return EnderRules::SpawnPointAllowed(PL.X, PL.Y, Face.X, Face.Y, Point.X, Point.Y);
}

bool AEnderEncounterDirector::PickSpawnPoint(EEnderArchetype Archetype, bool bElite, FVector& Out)
{
	UEnderRunRandomSubsystem* Run = GetWorld()->GetSubsystem<UEnderRunRandomSubsystem>();
	EnderRules::FRunRandom Fallback(0x5EA7u + static_cast<uint64>(Pending.Num()));
	EnderRules::FRunRandom& Rng = Run ? Run->Stream(EnderRules::Stream::Spawn) : Fallback;

	// Authored points first, in a seeded order.
	TArray<AEnderSpawnPoint*> Legal;
	for (AEnderSpawnPoint* Point : SpawnPoints)
	{
		if (Point && Point->Allows(Archetype, bElite) && IsSpawnLegalNow(Point->GetActorLocation()))
		{
			Legal.Add(Point);
		}
	}
	if (Legal.Num() > 0)
	{
		Out = Legal[Rng.RangeInt(0, Legal.Num() - 1)]->GetActorLocation();
		return true;
	}

	// Otherwise the navmesh inside the combat area.
	UNavigationSystemV1* Nav = FNavigationSystem::GetCurrent<UNavigationSystemV1>(GetWorld());
	if (!Nav)
	{
		return false;
	}
	const FVector Extent = CombatArea->GetScaledBoxExtent();
	const FTransform& Area = CombatArea->GetComponentTransform();
	const FVector Floor = RoomCentre();
	for (int32 Try = 0; Try < MaxPickTries; ++Try)
	{
		// Seeded target inside the area, snapped to the navmesh near it.
		const FVector Local(Rng.Range(-Extent.X + 100.0, Extent.X - 100.0), Rng.Range(-Extent.Y + 100.0, Extent.Y - 100.0), -Extent.Z);
		const FVector Target = Area.TransformPositionNoScale(Local);
		FNavLocation NavPoint;
		if (!Nav->GetRandomReachablePointInRadius(Target, 150.f, NavPoint))
		{
			continue;
		}
		const FVector LocalHit = Area.InverseTransformPositionNoScale(NavPoint.Location);
		if (FMath::Abs(LocalHit.X) > Extent.X || FMath::Abs(LocalHit.Y) > Extent.Y || FMath::Abs(NavPoint.Location.Z - Floor.Z) > 300.f)
		{
			continue;
		}
		if (IsSpawnLegalNow(NavPoint.Location))
		{
			Out = NavPoint.Location;
			return true;
		}
	}
	return false;
}

void AEnderEncounterDirector::Telegraph(FEnderPendingSpawn& P)
{
	if (AActor* Old = P.Telegraph.Get())
	{
		Old->Destroy();
	}
	P.Telegraph.Reset();
	P.bHasPoint = PickSpawnPoint(P.Archetype, P.Elite != EEnderEliteModifier::None, P.Location);
	if (!P.bHasPoint)
	{
		P.TimeLeft = RetryDelay; // wait and retry; never place illegally
		return;
	}
	P.TimeLeft = static_cast<float>(EnderRules::Waves::SpawnDelay);
	if (SpawnTelegraphClass)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		P.Telegraph = GetWorld()->SpawnActor<AActor>(SpawnTelegraphClass, FTransform(P.Location), Params);
	}
	OnSpawnTelegraph(P.Location, P.Archetype, P.Elite != EEnderEliteModifier::None);
}

void AEnderEncounterDirector::Materialise(FEnderPendingSpawn& P)
{
	if (AActor* T = P.Telegraph.Get())
	{
		T->Destroy();
	}
	const UEnderEnemyDefinition* Def = ResolveDefinition(P.Archetype);
	if (!Def || !Def->EnemyClass)
	{
		UE_LOG(LogEnder, Error, TEXT("%s: no enemy definition/class for %s"), *GetName(), *UEnum::GetValueAsString(P.Archetype));
		return;
	}
	float HalfHeight = 90.f;
	if (const ACharacter* CDO = Def->EnemyClass->GetDefaultObject<ACharacter>())
	{
		HalfHeight = CDO->GetCapsuleComponent() ? CDO->GetCapsuleComponent()->GetScaledCapsuleHalfHeight() : HalfHeight;
	}
	FVector ToPlayer = FVector::ForwardVector;
	if (const APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0))
	{
		ToPlayer = (Player->GetActorLocation() - P.Location).GetSafeNormal2D();
	}
	const FTransform Xf(ToPlayer.Rotation(), P.Location + FVector(0.f, 0.f, HalfHeight + 2.f));

	AEnderEnemyCharacter* Enemy = GetWorld()->SpawnActorDeferred<AEnderEnemyCharacter>(Def->EnemyClass, Xf, this, nullptr,
		ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
	if (!Enemy)
	{
		return;
	}
	Enemy->InitializeEnemy(Def, P.Elite);
	Enemy->FinishSpawning(Xf);
	Enemy->OnEnemyDied.AddDynamic(this, &ThisClass::HandleEnemyDied);

	FEnderLiveEnemy& L = Live.AddDefaulted_GetRef();
	L.Enemy = Enemy;
	L.Archetype = P.Archetype;
	L.bElite = P.Elite != EEnderEliteModifier::None;
	L.Wave = P.Wave;
	L.SpawnedAt = GetWorld()->GetTimeSeconds();
}

void AEnderEncounterDirector::HandleEnemyDied(AEnderEnemyCharacter* Enemy, AActor* Killer)
{
	for (FEnderLiveEnemy& L : Live)
	{
		if (L.bDead || L.Enemy.Get() != Enemy)
		{
			continue;
		}
		L.bDead = true;
		const FVector Where = Enemy ? Enemy->GetActorLocation() : RoomCentre();
		LastKillLocation = Where;
		if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
		{
			Telemetry->RecordTimeToKill(L.Archetype, L.bElite, static_cast<float>(GetWorld()->GetTimeSeconds() - L.SpawnedAt));
		}
		if (UEnderLootSubsystem* Loot = UEnderLootSubsystem::Get(this))
		{
			Loot->NotifyEnemyKilled(L.Archetype, L.bElite, Where);
		}
		if (UEnderRealmSubsystem* Realm = GetWorld()->GetSubsystem<UEnderRealmSubsystem>())
		{
			Realm->NotifyEnemyKilled(L.Archetype);
		}
		break;
	}
}

void AEnderEncounterDirector::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (State != EEnderEncounterState::Active)
	{
		return;
	}

	for (int32 I = Pending.Num() - 1; I >= 0; --I)
	{
		FEnderPendingSpawn& P = Pending[I];
		P.TimeLeft -= DeltaSeconds;
		if (P.TimeLeft > 0.f)
		{
			continue;
		}
		if (!P.bHasPoint || !IsSpawnLegalNow(P.Location))
		{
			// The Binder moved: the telegraphed point is now illegal. Re-pick and telegraph afresh.
			Telegraph(P);
			continue;
		}
		FEnderPendingSpawn Ready = P;
		Pending.RemoveAt(I);
		Materialise(Ready);
	}

	int32 AliveOpening = 0;
	for (const FEnderPendingSpawn& P : Pending) AliveOpening += P.Wave == 0 ? 1 : 0;
	for (const FEnderLiveEnemy& L : Live) AliveOpening += (!L.bDead && L.Wave == 0) ? 1 : 0;

	if (!bReinforced && EnderRules::ShouldReinforce(OpeningPopulation, AliveOpening, GetElapsed()))
	{
		bReinforced = true;
		QueueWave(1);
	}
	if (bReinforced && GetAliveCount() == 0)
	{
		Clear();
	}
}

void AEnderEncounterDirector::ForceClear()
{
	if (State != EEnderEncounterState::Active)
	{
		return;
	}
	for (FEnderPendingSpawn& P : Pending)
	{
		if (AActor* T = P.Telegraph.Get()) T->Destroy();
	}
	Pending.Reset();
	for (FEnderLiveEnemy& L : Live) L.bDead = true;
	bReinforced = true;
	Clear();
}

void AEnderEncounterDirector::Clear()
{
	State = EEnderEncounterState::Cleared;
	SetActorTickEnabled(false);
	const float Duration = GetElapsed();

	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->SetInCombat(false);
	}
	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		Telemetry->RecordRoomDuration(GetRoomKind(), Duration);
	}
	UEnderRealmSubsystem* Realm = GetWorld()->GetSubsystem<UEnderRealmSubsystem>();
	if (UEnderLootSubsystem* Loot = UEnderLootSubsystem::Get(this))
	{
		const bool bTutorial = Realm && Realm->IsTutorial();
		Loot->DropRoomRewards(GetRoomKind(), LastKillLocation.IsZero() ? RoomCentre() : LastKillLocation, bTutorial, ServiceRoomIndex());
	}
	SetDoorsLocked(false);
	if (Realm)
	{
		Realm->NotifyRoomCleared(this, Duration);
	}
	UE_LOG(LogEnder, Log, TEXT("%s cleared in %.1f s"), *GetName(), Duration);
	OnRoomCleared.Broadcast(this, GetRoomKind());
}

void AEnderEncounterDirector::SetDoorsLocked_Implementation(bool bLocked)
{
	for (AActor* Door : Doors)
	{
		if (Door)
		{
			Door->SetActorHiddenInGame(!bLocked);
			Door->SetActorEnableCollision(bLocked);
		}
	}
}

// ------------------------------------------------------------------ validation

void AEnderEncounterDirector::ValidateRoom()
{
	using namespace EnderRules::RoomGeometry;
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	const FVector Extent = CombatArea->GetScaledBoxExtent();
	const double Width = Extent.X * 2.0, Depth = Extent.Y * 2.0;
	const FTransform& Area = CombatArea->GetComponentTransform();
	TArray<FString> Lines;
	bool bOk = true;

	const bool bArea = AreaValid(Width, Depth);
	bOk &= bArea;
	Lines.Add(FString::Printf(TEXT("Combat area %.0f × %.0f cm: %s (min %.0f × %.0f, typical %.0f × %.0f)"), Width, Depth,
		bArea ? TEXT("ok") : TEXT("TOO SMALL"), MinWidth, MinDepth, TypicalWidth, TypicalDepth));

	// Obstacle coverage: a 50 cm grid of probes at hip height against static geometry.
	FCollisionQueryParams Params(SCENE_QUERY_STAT(EnderValidateRoom), false, this);
	for (AActor* Door : Doors) Params.AddIgnoredActor(Door);
	const FCollisionShape Probe = FCollisionShape::MakeBox(FVector(24.f, 24.f, 40.f));
	int32 Total = 0, Blocked = 0;
	for (double X = -Extent.X + 25.0; X < Extent.X; X += 50.0)
	{
		for (double Y = -Extent.Y + 25.0; Y < Extent.Y; Y += 50.0)
		{
			const FVector P = Area.TransformPositionNoScale(FVector(X, Y, -Extent.Z + 90.0));
			++Total;
			Blocked += World->OverlapBlockingTestByChannel(P, Area.GetRotation(), ECC_WorldStatic, Probe, Params) ? 1 : 0;
		}
	}
	const double Coverage = Total > 0 ? static_cast<double>(Blocked) / Total : 0.0;
	const bool bCoverage = CoverageValid(Coverage);
	bOk &= bCoverage;
	Lines.Add(FString::Printf(TEXT("Obstacle coverage %.1f%%: %s (10–22%%)"), Coverage * 100.0, bCoverage ? TEXT("ok") : TEXT("OUT OF RANGE")));

	// Corridor widths: the narrower of the two axis spans through each probe.
	for (int32 I = 0; I < CorridorProbes.Num(); ++I)
	{
		const FVector P = GetActorTransform().TransformPosition(CorridorProbes[I]);
		auto ClearDistance = [&](const FVector& Dir)
		{
			FHitResult Hit;
			const FVector End = P + Dir * 3000.f;
			return World->LineTraceSingleByChannel(Hit, P, End, ECC_WorldStatic, Params) ? Hit.Distance : 3000.f;
		};
		const FVector Fwd = GetActorForwardVector(), Right = GetActorRightVector();
		const double Span = FMath::Min(ClearDistance(Fwd) + ClearDistance(-Fwd), ClearDistance(Right) + ClearDistance(-Right));
		const bool bWide = Span >= MinCorridor;
		bOk &= bWide;
		Lines.Add(FString::Printf(TEXT("Corridor probe %d: %.0f cm clear: %s (min %.0f)"), I, Span, bWide ? TEXT("ok") : TEXT("TOO NARROW"), MinCorridor));
	}
	if (CorridorProbes.Num() == 0)
	{
		Lines.Add(TEXT("No corridor probes placed: add CorridorProbes at doorways to check the 450 cm minimum."));
	}

	LastValidationReport = FString::Printf(TEXT("%s — %s\n%s"), *GetName(), bOk ? TEXT("PASS") : TEXT("FAIL"), *FString::Join(Lines, TEXT("\n")));
	UE_LOG(LogEnder, Display, TEXT("%s"), *LastValidationReport);
}
