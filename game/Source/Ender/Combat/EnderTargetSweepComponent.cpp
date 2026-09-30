#include "Combat/EnderTargetSweepComponent.h"

#include "Ender.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Combat/EnderCombatStatics.h"
#include "Components/CapsuleComponent.h"
#include "DrawDebugHelpers.h"
#include "Engine/OverlapResult.h"
#include "Engine/World.h"
#include "GameFramework/Character.h"

UEnderTargetSweepComponent::UEnderTargetSweepComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

int32 UEnderTargetSweepComponent::BeginExecution()
{
	AlreadyHitActors.Reset();
	return ++ExecutionId;
}

void UEnderTargetSweepComponent::EndExecution()
{
	AlreadyHitActors.Reset();
}

bool UEnderTargetSweepComponent::IsValidTarget(const AActor* Actor) const
{
	if (!Actor || Actor == GetOwner() || !UEnderCombatStatics::IsAlive(Actor)) return false;
	const UAbilitySystemComponent* ASC = UEnderCombatStatics::ASCOf(Actor);
	if (!ASC) return false;
	const bool bIsEnemy = ASC->HasMatchingGameplayTag(EnderTags::Enemy_Normal) || ASC->HasMatchingGameplayTag(EnderTags::Enemy_Elite) ||
		ASC->HasMatchingGameplayTag(EnderTags::Enemy_Boss);
	return Team == EEnderSweepTeam::Enemies ? bIsEnemy : !bIsEnemy;
}

bool UEnderTargetSweepComponent::Accept(AActor* Actor, bool bMultiHit)
{
	if (!IsValidTarget(Actor)) return false;
	if (bMultiHit) return true;
	bool bAlready = false;
	AlreadyHitActors.Add(FObjectKey(Actor), &bAlready);
	return !bAlready;
}

FHitResult UEnderTargetSweepComponent::MakeHit(AActor* Target, const FVector& From)
{
	FHitResult Hit;
	Hit.HitObjectHandle = FActorInstanceHandle(Target);
	Hit.Location = Target->GetActorLocation();
	Hit.ImpactPoint = Target->GetActorLocation();
	Hit.TraceStart = From;
	Hit.TraceEnd = Target->GetActorLocation();
	const FVector N = (From - Target->GetActorLocation()).GetSafeNormal2D();
	Hit.ImpactNormal = N;
	Hit.Normal = N;
	Hit.bBlockingHit = false;
	return Hit;
}

void UEnderTargetSweepComponent::Overlap(const FVector& Center, float Radius, TArray<AActor*>& Out) const
{
	TArray<FOverlapResult> Overlaps;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(EnderCombatOverlap), false, GetOwner());
	// Tall capsule so height differences on stairs/ramps never cause a whiff.
	GetWorld()->OverlapMultiByChannel(Overlaps, Center, FQuat::Identity, ENDER_TRACE_COMBAT,
		FCollisionShape::MakeCapsule(Radius, FMath::Max(Radius, 250.f)), Params);
	for (const FOverlapResult& O : Overlaps)
	{
		if (AActor* A = O.GetActor()) Out.AddUnique(A);
	}
}

static float CapsuleRadiusOf(const AActor* A)
{
	const ACharacter* C = Cast<ACharacter>(A);
	return C && C->GetCapsuleComponent() ? C->GetCapsuleComponent()->GetScaledCapsuleRadius() : 0.f;
}

TArray<FHitResult> UEnderTargetSweepComponent::SphereSweep(FVector Start, FVector End, float Radius, bool bMultiHit)
{
	TArray<FHitResult> Out;
	TArray<FHitResult> Hits;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(EnderCombatSweep), false, GetOwner());
	GetWorld()->SweepMultiByChannel(Hits, Start, End, FQuat::Identity, ENDER_TRACE_COMBAT, FCollisionShape::MakeSphere(Radius), Params);
	for (const FHitResult& H : Hits)
		if (Accept(H.GetActor(), bMultiHit)) Out.Add(H);
	if (bDrawDebug) DrawDebugCapsule(GetWorld(), (Start + End) * 0.5f, (End - Start).Size() * 0.5f + Radius, Radius,
		FRotationMatrix::MakeFromZ(End - Start).ToQuat(), FColor(225, 106, 84), false, 0.4f);
	return Out;
}

TArray<FHitResult> UEnderTargetSweepComponent::CapsuleSweep(FVector Start, FVector End, float Radius, float HalfHeight, bool bMultiHit)
{
	TArray<FHitResult> Out;
	TArray<FHitResult> Hits;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(EnderCombatSweep), false, GetOwner());
	GetWorld()->SweepMultiByChannel(Hits, Start, End, FQuat::Identity, ENDER_TRACE_COMBAT, FCollisionShape::MakeCapsule(Radius, HalfHeight), Params);
	for (const FHitResult& H : Hits)
		if (Accept(H.GetActor(), bMultiHit)) Out.Add(H);
	return Out;
}

TArray<FHitResult> UEnderTargetSweepComponent::ConeQuery(FVector Origin, FVector Forward, float Range, float ArcDegrees, bool bMultiHit)
{
	TArray<FHitResult> Out;
	TArray<AActor*> Candidates;
	Overlap(Origin, Range + 60.f, Candidates);
	const FVector Fwd = Forward.GetSafeNormal2D();
	const float HalfArc = FMath::DegreesToRadians(ArcDegrees * 0.5f);
	for (AActor* A : Candidates)
	{
		const float CapR = CapsuleRadiusOf(A);
		const FVector To = (A->GetActorLocation() - Origin) * FVector(1, 1, 0);
		const float Dist = To.Size();
		if (Dist - CapR > Range) continue;
		if (Dist > KINDA_SMALL_NUMBER)
		{
			// Widen the angle by the capsule's angular half-size so a target half inside the arc counts.
			const float Angle = FMath::Acos(FMath::Clamp(FVector::DotProduct(To / Dist, Fwd), -1.f, 1.f));
			const float Slack = FMath::Asin(FMath::Clamp(CapR / FMath::Max(Dist, CapR), 0.f, 1.f));
			if (Angle > HalfArc + Slack) continue;
		}
		if (Accept(A, bMultiHit)) Out.Add(MakeHit(A, Origin));
	}
	if (bDrawDebug)
	{
		DrawDebugCone(GetWorld(), Origin, Fwd, Range, HalfArc, 0.f, 12, FColor(225, 106, 84), false, 0.4f);
	}
	return Out;
}

TArray<FHitResult> UEnderTargetSweepComponent::RadialQuery(FVector Center, float Radius, bool bMultiHit)
{
	TArray<FHitResult> Out;
	TArray<AActor*> Candidates;
	Overlap(Center, Radius + 60.f, Candidates);
	for (AActor* A : Candidates)
	{
		const float Dist2D = FVector::Dist2D(A->GetActorLocation(), Center);
		if (Dist2D - CapsuleRadiusOf(A) > Radius) continue;
		if (Accept(A, bMultiHit)) Out.Add(MakeHit(A, Center));
	}
	if (bDrawDebug) DrawDebugCircle(GetWorld(), Center, Radius, 48, FColor(225, 106, 84), false, 0.2f, 0, 2.f, FVector(1, 0, 0), FVector(0, 1, 0), false);
	return Out;
}

TArray<FHitResult> UEnderTargetSweepComponent::LaneQuery(FVector Start, FVector Direction, float Length, float Width, bool bMultiHit)
{
	TArray<FHitResult> Out;
	TArray<AActor*> Candidates;
	const FVector Dir = Direction.GetSafeNormal2D();
	Overlap(Start + Dir * Length * 0.5f, Length * 0.5f + Width, Candidates);
	const FVector Side(-Dir.Y, Dir.X, 0.f);
	for (AActor* A : Candidates)
	{
		const FVector To = (A->GetActorLocation() - Start) * FVector(1, 1, 0);
		const float Along = FVector::DotProduct(To, Dir);
		const float Across = FMath::Abs(FVector::DotProduct(To, Side));
		const float CapR = CapsuleRadiusOf(A);
		if (Along < -CapR || Along > Length + CapR || Across > Width * 0.5f + CapR) continue;
		if (Accept(A, bMultiHit)) Out.Add(MakeHit(A, Start));
	}
	return Out;
}
