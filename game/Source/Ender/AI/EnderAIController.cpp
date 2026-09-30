#include "AI/EnderAIController.h"

#include "AI/EnderEnemyCharacter.h"
#include "AI/EnderEnemyDefinition.h"
#include "Components/StateTreeAIComponent.h"
#include "Navigation/PathFollowingComponent.h"
#include "NavigationSystem.h"
#include "StateTree.h"

AEnderAIController::AEnderAIController(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	StateTreeComponent = CreateDefaultSubobject<UStateTreeAIComponent>(TEXT("StateTree"));
	BrainComponent = StateTreeComponent;
	// Started by hand in OnPossess, after the tree from the enemy's definition is set.
	bStartAILogicOnPossess = false;
}

AEnderEnemyCharacter* AEnderAIController::GetEnemy() const
{
	return Cast<AEnderEnemyCharacter>(GetPawn());
}

void AEnderAIController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);

	UStateTree* Tree = DefaultStateTree;
	if (const AEnderEnemyCharacter* Enemy = Cast<AEnderEnemyCharacter>(InPawn))
	{
		if (Enemy->GetDefinition() && Enemy->GetDefinition()->StateTree) Tree = Enemy->GetDefinition()->StateTree;
	}
	if (!StateTreeComponent || StateTreeComponent->IsRunning()) return;
	if (Tree) StateTreeComponent->SetStateTree(Tree);
	StateTreeComponent->StartLogic();
}

void AEnderAIController::OnUnPossess()
{
	StopBrain(TEXT("Unpossessed"));
	Super::OnUnPossess();
}

void AEnderAIController::StopBrain(const FString& Reason)
{
	StopMovement();
	ClearFocus(EAIFocusPriority::Gameplay);
	if (StateTreeComponent && StateTreeComponent->IsRunning()) StateTreeComponent->StopLogic(Reason);
}

bool AEnderAIController::RepathDue()
{
	const double Now = GetWorld()->GetTimeSeconds();
	if (Now < NextRepathTime && GetMoveStatus() != EPathFollowingStatus::Idle) return false;
	NextRepathTime = Now + RepathInterval;
	return true;
}

bool AEnderAIController::MoveToNavPoint(const FVector& Point, float Acceptance)
{
	FVector Goal = Point;
	if (UNavigationSystemV1* Nav = UNavigationSystemV1::GetCurrent<UNavigationSystemV1>(GetWorld()))
	{
		FNavLocation Projected;
		if (!Nav->ProjectPointToNavigation(Point, Projected, FVector(200.f, 200.f, 300.f))) return false;
		Goal = Projected.Location;
	}
	return MoveToLocation(Goal, Acceptance, true, true, false, true) != EPathFollowingRequestResult::Failed;
}

bool AEnderAIController::ApproachTarget(float Acceptance)
{
	AEnderEnemyCharacter* Enemy = GetEnemy();
	AActor* Target = Enemy ? Enemy->GetCombatTarget() : nullptr;
	if (!Target) return false;
	FaceTarget();
	if (Enemy->GetDistanceToTarget() <= Acceptance)
	{
		StopMovement();
		return true;
	}
	// MoveToActor follows a moving goal by itself; only re-issue when path following went idle.
	if (GetMoveStatus() == EPathFollowingStatus::Idle)
	{
		MoveToActor(Target, FMath::Max(10.f, Acceptance * 0.8f), true);
	}
	return false;
}

bool AEnderAIController::MaintainRange(float Min, float Max)
{
	AEnderEnemyCharacter* Enemy = GetEnemy();
	AActor* Target = Enemy ? Enemy->GetCombatTarget() : nullptr;
	if (!Target) return false;
	FaceTarget();

	// The Wisp's band is a single distance (700), so settle within a little slack either side.
	constexpr float Slack = 75.f;
	const float Dist = Enemy->GetDistanceToTarget();
	const bool bSight = LineOfSightTo(Target);
	const bool bInBand = Dist >= Min - Slack && Dist <= Max + Slack;
	if (bInBand && bSight)
	{
		StopMovement();
		return true;
	}
	if (!RepathDue()) return false;

	FVector Away = (Enemy->GetActorLocation() - Target->GetActorLocation()).GetSafeNormal2D(UE_SMALL_NUMBER, -Enemy->GetActorForwardVector());
	if (!bSight && bInBand)
	{
		// In the band but blocked: slide around the target to find a line.
		Away = Away.RotateAngleAxis(35.f * OrbitSign, FVector::UpVector);
	}
	const float Want = FMath::Clamp(Dist, Min, FMath::Max(Min, Max));
	if (!MoveToNavPoint(Target->GetActorLocation() + Away * Want, 40.f)) OrbitSign = -OrbitSign;
	return false;
}

void AEnderAIController::OrbitTarget(float Radius, float DeltaSeconds)
{
	AEnderEnemyCharacter* Enemy = GetEnemy();
	AActor* Target = Enemy ? Enemy->GetCombatTarget() : nullptr;
	if (!Target) return;
	FaceTarget();

	// Flip direction when a wall or another enemy pins us in place.
	OrbitCheckSeconds += DeltaSeconds;
	if (OrbitCheckSeconds >= 0.4f)
	{
		if (FVector::Dist2D(LastOrbitCheckLocation, Enemy->GetActorLocation()) < 10.f) OrbitSign = -OrbitSign;
		LastOrbitCheckLocation = Enemy->GetActorLocation();
		OrbitCheckSeconds = 0.f;
	}
	if (!RepathDue()) return;

	const FVector Away = (Enemy->GetActorLocation() - Target->GetActorLocation()).GetSafeNormal2D(UE_SMALL_NUMBER, -Enemy->GetActorForwardVector());
	const FVector Ahead = Away.RotateAngleAxis(40.f * OrbitSign, FVector::UpVector);
	if (!MoveToNavPoint(Target->GetActorLocation() + Ahead * Radius, 30.f)) OrbitSign = -OrbitSign;
}

void AEnderAIController::FaceTarget()
{
	const AEnderEnemyCharacter* Enemy = GetEnemy();
	if (AActor* Target = Enemy ? Enemy->GetCombatTarget() : nullptr)
	{
		if (GetFocusActor() != Target) SetFocus(Target, EAIFocusPriority::Gameplay);
	}
}

void AEnderAIController::LockFacing(const FVector& Direction)
{
	APawn* MyPawn = GetPawn();
	if (!MyPawn) return;
	const FVector Dir = Direction.GetSafeNormal2D(UE_SMALL_NUMBER, MyPawn->GetActorForwardVector());
	StopMovement();
	SetFocalPoint(MyPawn->GetActorLocation() + Dir * 500.f, EAIFocusPriority::Gameplay);
	SetControlRotation(Dir.Rotation());
	MyPawn->SetActorRotation(FRotator(0.f, Dir.Rotation().Yaw, 0.f));
}

void AEnderAIController::UnlockFacing()
{
	ClearFocus(EAIFocusPriority::Gameplay);
}
