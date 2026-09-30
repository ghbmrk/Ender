#pragma once

#include "Components/ActorComponent.h"
#include "UObject/ObjectKey.h"
#include "EnderTargetSweepComponent.generated.h"

/** Which side a query collects. */
UENUM(BlueprintType)
enum class EEnderSweepTeam : uint8
{
	Enemies,  // Binder queries: the Hushed and the Bound King
	Player,   // Hushed queries: the Binder
};

/**
 * §31 hit detection. Never weapon-mesh collision: every attack is a shaped query
 * on the Combat trace channel. An ability execution opens a hit set (BeginExecution)
 * and each query filters out actors already hit in it, unless the query is flagged
 * multi-hit (Grand Fracture's three strikes).
 */
UCLASS(ClassGroup = (Ender), meta = (BlueprintSpawnableComponent))
class ENDER_API UEnderTargetSweepComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UEnderTargetSweepComponent();

	/** Starts a new execution; returns its id. Previous hit set is dropped. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	int32 BeginExecution();

	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	void EndExecution();

	/** Swept sphere from Start to End. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	TArray<FHitResult> SphereSweep(FVector Start, FVector End, float Radius, bool bMultiHit = false);

	/** Swept capsule (vertical) from Start to End. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	TArray<FHitResult> CapsuleSweep(FVector Start, FVector End, float Radius, float HalfHeight, bool bMultiHit = false);

	/**
	 * Targets whose capsule intersects a flat cone: apex at Origin, axis Forward (2D),
	 * reach Range, full angle ArcDegrees. The capsule radius is added to the range and
	 * the angle test uses the capsule's nearest point so edges feel fair.
	 */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	TArray<FHitResult> ConeQuery(FVector Origin, FVector Forward, float Range, float ArcDegrees, bool bMultiHit = false);

	/** Targets whose capsule intersects a disc of Radius around Center (2D). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	TArray<FHitResult> RadialQuery(FVector Center, float Radius, bool bMultiHit = false);

	/** Axis-aligned-to-Direction rectangle (lanes, lances): from Start, Length × Width. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	TArray<FHitResult> LaneQuery(FVector Start, FVector Direction, float Length, float Width, bool bMultiHit = false);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ender|Combat")
	EEnderSweepTeam Team = EEnderSweepTeam::Enemies;

	UPROPERTY(EditAnywhere, Category = "Ender|Combat|Debug")
	bool bDrawDebug = false;

	int32 GetExecutionId() const { return ExecutionId; }
	bool WasHit(const AActor* Actor) const { return AlreadyHitActors.Contains(FObjectKey(Actor)); }

private:
	void Overlap(const FVector& Center, float Radius, TArray<AActor*>& Out) const;
	bool Accept(AActor* Actor, bool bMultiHit);
	bool IsValidTarget(const AActor* Actor) const;
	static FHitResult MakeHit(AActor* Target, const FVector& From);

	TSet<FObjectKey> AlreadyHitActors;
	int32 ExecutionId = 0;
};
