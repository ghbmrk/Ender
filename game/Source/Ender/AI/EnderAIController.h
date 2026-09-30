#pragma once

#include "AIController.h"
#include "EnderAIController.generated.h"

class AEnderEnemyCharacter;
class UStateTree;
class UStateTreeAIComponent;

/**
 * Runs the enemy's StateTree (Content/AI/STATETREE_LAYOUT.md) and owns its
 * pathing. Movement helpers use the Navigation System directly (MoveToActor /
 * MoveToLocation onto projected nav points); no EQS — the Hushed only need
 * "close in", "hold a band" and "circle", which are cheaper as plain geometry.
 */
UCLASS()
class ENDER_API AEnderAIController : public AAIController
{
	GENERATED_BODY()

public:
	AEnderAIController(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());

	AEnderEnemyCharacter* GetEnemy() const;
	UStateTreeAIComponent* GetStateTreeComponent() const { return StateTreeComponent; }

	/** Paths toward the target until within Acceptance (2D). Returns true once there. */
	bool ApproachTarget(float Acceptance);

	/** Steps in or out to sit between Min and Max from the target with sight of it. True when settled. */
	bool MaintainRange(float Min, float Max);

	/** Circles the target at Radius; direction flips when blocked. */
	void OrbitTarget(float Radius, float DeltaSeconds);

	/** Face the target while moving (strafe). */
	void FaceTarget();

	/** Stop turning toward the target and hold Direction (attack windup/execute). */
	void LockFacing(const FVector& Direction);
	void UnlockFacing();

	void StopBrain(const FString& Reason);

protected:
	virtual void OnPossess(APawn* InPawn) override;
	virtual void OnUnPossess() override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|AI") TObjectPtr<UStateTreeAIComponent> StateTreeComponent;

	/** Used when the enemy's definition names no tree. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|AI") TObjectPtr<UStateTree> DefaultStateTree;

	/** How often movement goals are re-issued while the target moves. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|AI") float RepathInterval = 0.35f;

private:
	bool MoveToNavPoint(const FVector& Point, float Acceptance);

	bool RepathDue();

	double NextRepathTime = 0.0;
	float OrbitSign = 1.f;
	FVector LastOrbitCheckLocation = FVector::ZeroVector;
	float OrbitCheckSeconds = 0.f;
};
