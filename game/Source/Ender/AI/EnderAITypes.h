#pragma once

#include "CoreMinimal.h"
#include "EnderAITypes.generated.h"

class UEnderTargetSweepComponent;

UENUM(BlueprintType)
enum class EEnderTelegraphShape : uint8
{
	Circle,
	Cone,
	Lane,
};

/** Where an enemy is in its attack. Tokens are held from Telegraph until Recover ends. */
UENUM(BlueprintType)
enum class EEnderAttackPhase : uint8
{
	None,
	Telegraph,
	Execute,
	Recover,
};

/** How an attack lands once its telegraph resolves. */
UENUM(BlueprintType)
enum class EEnderAttackDelivery : uint8
{
	Strike,     // one shape query at resolution (Husk, Keeper)
	Leap,       // crosses the telegraphed lane, hitting what its body passes (Hound)
	Projectile, // pooled shot down the telegraphed lane (Wisp)
	Hazard,     // pooled ground pool at the telegraphed circle (Seer)
};

UENUM(BlueprintType)
enum class EEnderAttackSlot : uint8
{
	Primary,
	Heavy,
};

/**
 * One telegraphed region on the floor. The telegraph actor draws exactly this and
 * the damage query reads exactly this, so the two cannot drift apart (§ telegraph
 * rule: overlap within 20 cm and 50 ms).
 */
USTRUCT(BlueprintType)
struct ENDER_API FEnderTelegraphShape
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Telegraph") EEnderTelegraphShape Shape = EEnderTelegraphShape::Circle;
	/** Circle centre, cone apex, lane start. On the floor. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Telegraph") FVector Origin = FVector::ZeroVector;
	/** Cone axis / lane direction, 2D unit. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Telegraph") FVector Direction = FVector::ForwardVector;
	/** Circle radius, or cone reach. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Telegraph") float Radius = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Telegraph") float ArcDegrees = 90.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Telegraph") float Length = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Telegraph") float Width = 0.f;

	static FEnderTelegraphShape MakeCircle(const FVector& Center, float InRadius);
	static FEnderTelegraphShape MakeCone(const FVector& Apex, const FVector& Forward, float Reach, float InArcDegrees);
	static FEnderTelegraphShape MakeLane(const FVector& Start, const FVector& InDirection, float InLength, float InWidth);

	/** The damage region: runs the matching query on Sweep with these exact parameters. */
	TArray<FHitResult> Query(UEnderTargetSweepComponent* Sweep, bool bMultiHit = false) const;

	/** Half extents on the floor (forward, side) of the box that bounds the shape around its draw centre. */
	FVector2D DrawHalfExtents() const;
	/** Centre of that box: circle/cone at Origin, lane at its midpoint. */
	FVector DrawCenter() const;
};
