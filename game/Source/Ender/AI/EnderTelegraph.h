#pragma once

#include "GameFramework/Actor.h"
#include "AI/EnderAITypes.h"
#include "EnderTelegraph.generated.h"

class UDecalComponent;
class UMaterialInstanceDynamic;
class UMaterialInterface;
class AEnderTelegraph;

DECLARE_MULTICAST_DELEGATE_OneParam(FEnderOnTelegraphResolved, AEnderTelegraph* /*Telegraph*/);

/**
 * Pooled floor telegraph (circle / cone / lane). It is the single clock for its
 * attack: OnResolved fires on the tick its windup ends, and the attacker runs the
 * damage query from GetShape() in that callback, so the drawn region and the hit
 * region are the same numbers at the same moment.
 *
 * Look (§ telegraphs): danger #E16A54, 2 px ink perimeter, 25% watercolour fill
 * with an animated brush; at activation the fill goes to 55% and the perimeter
 * flashes cream for 70 ms. Colourblind mode adds an animated diagonal hatch and
 * a thicker boundary. The decal material (M_Telegraph) reads these parameters:
 *   scalars  Shape (0 circle, 1 cone, 2 lane), Radius, ArcDegrees, Length, Width,
 *            HalfForward, HalfSide, Progress, Fill, FlashCream, Hatch, PerimeterPx
 *   vector   DangerColor
 * The decal box is oriented along the shape's direction: U runs forward, V to the side.
 */
UCLASS(Blueprintable)
class ENDER_API AEnderTelegraph : public AActor
{
	GENERATED_BODY()

public:
	AEnderTelegraph();

	/** Shows the shape and starts the windup clock. Duration must already respect its class floor. */
	void Begin(const FEnderTelegraphShape& InShape, float InDuration, AActor* InSource);

	/** Keep the activated region drawn after resolution until Release (Hound leap). */
	void SetHoldAfterActivation(bool bHold) { bHoldAfterActivation = bHold; }

	/** Ends a resolved/held telegraph and returns it to the pool. */
	void Release();

	/** Aborted attack: vanishes without resolving; OnResolved never fires. */
	void Cancel();

	const FEnderTelegraphShape& GetShape() const { return Shape; }
	float GetDuration() const { return Duration; }
	float GetElapsed() const { return Elapsed; }
	bool IsLive() const { return bLive; }
	bool IsActivated() const { return bActivated; }
	AActor* GetSource() const { return Source.Get(); }

	/** Bind after Begin; Begin drops the previous user's listeners. */
	FEnderOnTelegraphResolved OnResolved;

	/** Pool use only: hides and parks the actor. */
	void Deactivate();

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

	/** Spawn NS_TelegraphCircle / NS_TelegraphCone (lanes use the cone system stretched) here. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Telegraph")
	void OnTelegraphBegin(EEnderTelegraphShape InShape, float InDuration);

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Telegraph")
	void OnTelegraphActivated();

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Telegraph")
	void OnTelegraphEnded(bool bCancelled);

	UPROPERTY(VisibleAnywhere, Category = "Ender|Telegraph") TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Telegraph") TObjectPtr<UDecalComponent> Decal;

	UPROPERTY(EditDefaultsOnly, Category = "Ender|Telegraph") TObjectPtr<UMaterialInterface> DecalMaterial;
	/** How long the activated region stays drawn when nothing holds it. Longer than the 70 ms flash. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Telegraph", meta = (ClampMin = "0.07")) float LingerSeconds = 0.15f;
	/** Vertical reach of the projection so slopes and steps still receive the decal. */
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Telegraph") float ProjectionHalfDepth = 150.f;

	UPROPERTY(Transient) TObjectPtr<UMaterialInstanceDynamic> Material;

private:
	void PushShapeParams();
	void PushLook();
	void Finish(bool bCancelled);
	void HandleColourblindChanged(bool bEnabled);

	FEnderTelegraphShape Shape;
	TWeakObjectPtr<AActor> Source;
	FDelegateHandle ColourblindHandle;
	float Duration = 0.f;
	float Elapsed = 0.f;
	bool bLive = false;
	bool bActivated = false;
	bool bHoldAfterActivation = false;
	bool bColourblind = false;
};
