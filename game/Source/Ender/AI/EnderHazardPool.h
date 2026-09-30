#pragma once

#include "GameFramework/Actor.h"
#include "EnderHazardPool.generated.h"

class UDecalComponent;
class UMaterialInstanceDynamic;
class UMaterialInterface;
class UEnderTargetSweepComponent;

/**
 * The Seer's ink pool (pooled). After its activation delay it deals damage to the
 * Binder inside Radius in 0.5 s slices (7/s → 3.5 per slice) until Duration ends.
 * Draws with the telegraph material at the activated look so it reads as the same
 * danger language; the parameters match AEnderTelegraph's.
 */
UCLASS(Blueprintable)
class ENDER_API AEnderHazardPool : public AActor
{
	GENERATED_BODY()

public:
	AEnderHazardPool();

	void Begin(AActor* InSource, const FVector& Center, float InRadius, float InActivationDelay, float InDuration, float DamagePerSecond);

	/** Pool use: parks the actor. Also ends a pool early. */
	void Deactivate();

	bool IsLive() const { return bLive; }
	AActor* GetSource() const { return Source.Get(); }

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Hazard") void OnHazardBegin(float InRadius, float InDuration);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Hazard") void OnHazardActivated();
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Hazard") void OnHazardEnded();

	UPROPERTY(VisibleAnywhere, Category = "Ender|Hazard") TObjectPtr<USceneComponent> Root;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Hazard") TObjectPtr<UDecalComponent> Decal;
	UPROPERTY(VisibleAnywhere, Category = "Ender|Hazard") TObjectPtr<UEnderTargetSweepComponent> TargetSweep;
	UPROPERTY(EditDefaultsOnly, Category = "Ender|Hazard") TObjectPtr<UMaterialInterface> DecalMaterial;
	UPROPERTY(Transient) TObjectPtr<UMaterialInstanceDynamic> Material;

private:
	void DealTick();

	TWeakObjectPtr<AActor> Source;
	float Radius = 0.f;
	float ActivationDelay = 0.f;
	float Duration = 0.f;
	float DamagePerTick = 0.f;
	float Elapsed = 0.f;
	int32 TicksDealt = 0;
	int32 TicksTotal = 0;
	bool bLive = false;
	bool bActivated = false;
};
