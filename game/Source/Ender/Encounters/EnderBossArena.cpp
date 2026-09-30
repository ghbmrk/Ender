#include "Encounters/EnderBossArena.h"

#include "AI/EnderBoundKing.h"
#include "AI/EnderEnemyDefinition.h"
#include "Components/ArrowComponent.h"
#include "Components/BoxComponent.h"
#include "Encounters/EnderRealmSubsystem.h"
#include "Ender.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Reality/EnderRealityClient.h"

AEnderBossArena::AEnderBossArena()
{
	PrimaryActorTick.bCanEverTick = false;
	Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("Trigger"));
	Trigger->InitBoxExtent(FVector(1400.f, 1400.f, 250.f));
	Trigger->SetCollisionProfileName(TEXT("Trigger"));
	RootComponent = Trigger;

	BossSpawn = CreateDefaultSubobject<UArrowComponent>(TEXT("BossSpawn"));
	BossSpawn->SetupAttachment(Trigger);
	BossSpawn->SetHiddenInGame(true);
	BossSpawn->ArrowColor = FColor(0x54, 0x31, 0x31);
}

void AEnderBossArena::BeginPlay()
{
	Super::BeginPlay();
	Trigger->OnComponentBeginOverlap.AddDynamic(this, &ThisClass::HandleTriggerOverlap);
	SetDoorsLocked(false);
}

void AEnderBossArena::HandleTriggerOverlap(UPrimitiveComponent*, AActor* OtherActor, UPrimitiveComponent*, int32, bool, const FHitResult&)
{
	const APawn* Pawn = Cast<APawn>(OtherActor);
	if (!bEngaged && Pawn && Pawn->IsPlayerControlled())
	{
		Engage();
	}
}

void AEnderBossArena::Engage()
{
	UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this);
	if (bEngaged || (Realm && Realm->IsRealmActive() && !Realm->CanEnterSegment(EEnderRealmSegment::Boss)))
	{
		return;
	}
	bEngaged = true;
	SetDoorsLocked(true);

	const bool bTutorial = Realm && Realm->IsTutorial();
	if (PlacedBoss)
	{
		Boss = PlacedBoss;
		Boss->bTutorial = bTutorial;
		Boss->SetActorHiddenInGame(false);
	}
	else if (BossDefinition && BossDefinition->EnemyClass && BossDefinition->EnemyClass->IsChildOf(AEnderBoundKing::StaticClass()))
	{
		const FTransform Xf = BossSpawn->GetComponentTransform();
		Boss = GetWorld()->SpawnActorDeferred<AEnderBoundKing>(BossDefinition->EnemyClass.Get(), Xf, this, nullptr,
			ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
		if (Boss)
		{
			Boss->bTutorial = bTutorial;
			Boss->InitializeEnemy(BossDefinition, EEnderEliteModifier::None);
			Boss->FinishSpawning(Xf);
		}
	}
	if (!Boss)
	{
		UE_LOG(LogEnder, Error, TEXT("%s: no Bound King to fight (set BossDefinition or PlacedBoss)"), *GetName());
		return;
	}
	Boss->OnBossDefeated.AddDynamic(this, &ThisClass::HandleBossDefeated);
	Boss->OnPhaseChanged.AddDynamic(this, &ThisClass::HandlePhaseChanged);
	if (Realm)
	{
		Realm->NotifyBossEngaged(Boss);
	}
	else if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->SetInCombat(true);
	}
	OnBossSpawned(Boss);
}

void AEnderBossArena::HandlePhaseChanged(AEnderBoundKing* InBoss, int32 NewPhase)
{
	if (UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this))
	{
		Realm->NotifyBossPhase(NewPhase);
	}
}

void AEnderBossArena::HandleBossDefeated(AEnderBoundKing* InBoss)
{
	SetDoorsLocked(false);
	if (UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this))
	{
		Realm->NotifyBossDefeated(InBoss);
	}
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->SetInCombat(false);
	}
}

void AEnderBossArena::SetDoorsLocked_Implementation(bool bLocked)
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
