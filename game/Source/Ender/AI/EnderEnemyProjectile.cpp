#include "AI/EnderEnemyProjectile.h"

#include "Combat/EnderTargetSweepComponent.h"
#include "Components/SphereComponent.h"

AEnderEnemyProjectile::AEnderEnemyProjectile()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = false;
	SetCanBeDamaged(false);

	Collision = CreateDefaultSubobject<USphereComponent>(TEXT("Collision"));
	Collision->InitSphereRadius(20.f);
	Collision->SetCollisionProfileName(TEXT("EnderEnemyProjectile"));
	Collision->SetGenerateOverlapEvents(false);
	Collision->SetCanEverAffectNavigation(false);
	SetRootComponent(Collision);

	TargetSweep = CreateDefaultSubobject<UEnderTargetSweepComponent>(TEXT("TargetSweep"));
	TargetSweep->Team = EEnderSweepTeam::Player;

	SetActorEnableCollision(false);
	SetActorHiddenInGame(true);
}

void AEnderEnemyProjectile::Launch(AActor* InSource, const FVector& Start, const FVector& InDirection, float InSpeed,
	float MaxDistance, float InRadius, const FEnderDamageParams& InDamage)
{
	Source = InSource;
	Damage = InDamage;
	Damage.bCanCrit = false;
	Direction = InDirection.GetSafeNormal2D(UE_SMALL_NUMBER, FVector::ForwardVector);
	Speed = FMath::Max(1.f, InSpeed);
	Remaining = FMath::Max(0.f, MaxDistance);
	Radius = FMath::Max(1.f, InRadius);

	Collision->SetSphereRadius(Radius, false);
	Collision->ClearMoveIgnoreActors();
	if (InSource) Collision->IgnoreActorWhenMoving(InSource, true);
	SetActorLocationAndRotation(Start, Direction.Rotation(), false, nullptr, ETeleportType::ResetPhysics);
	SetActorEnableCollision(true);
	SetActorHiddenInGame(false);
	SetActorTickEnabled(true);
	TargetSweep->BeginExecution();
	bInFlight = true;
	OnLaunched();
}

void AEnderEnemyProjectile::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!bInFlight) return;

	const float Step = FMath::Min(Speed * DeltaSeconds, Remaining);
	const FVector From = GetActorLocation();
	FHitResult Block;
	SetActorLocation(From + Direction * Step, true, &Block);
	const FVector To = GetActorLocation();
	Remaining -= FVector::Dist(From, To);

	// Binder first: a shot that reaches the Binder and a wall in the same step hits the Binder.
	for (const FHitResult& Hit : TargetSweep->SphereSweep(From, To, Radius))
	{
		if (AActor* Target = Hit.GetActor())
		{
			const bool bApplied = Source.IsValid() && UEnderCombatStatics::ApplyDamage(Source.Get(), Target, Damage, Hit);
			if (bApplied)
			{
				End(Hit.ImpactPoint, true);
				return;
			}
		}
	}

	if (Block.bBlockingHit)
	{
		End(Block.ImpactPoint, false);
		return;
	}
	if (Remaining <= KINDA_SMALL_NUMBER)
	{
		End(To, false);
	}
}

void AEnderEnemyProjectile::End(const FVector& Where, bool bHitBinder)
{
	OnImpact(Where, bHitBinder);
	Deactivate();
}

void AEnderEnemyProjectile::Deactivate()
{
	bInFlight = false;
	Source.Reset();
	Collision->ClearMoveIgnoreActors();
	TargetSweep->EndExecution();
	SetActorEnableCollision(false);
	SetActorHiddenInGame(true);
	SetActorTickEnabled(false);
}
