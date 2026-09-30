#pragma once

#include "GameFramework/Actor.h"
#include "Combat/EnderCombatStatics.h"
#include "EnderEnemyProjectile.generated.h"

class USphereComponent;
class UEnderTargetSweepComponent;

/**
 * Pooled enemy projectile (Wisp shot, Bound King's Ink Lance). Moves in a straight
 * line down the lane its telegraph drew, on the EnderEnemyProjectile profile: world
 * geometry and Keepers (EnderKeeper blocks the channel) stop it, other Hushed do
 * not. Hits on the Binder come from a Combat-channel sweep of the step just moved,
 * so a fast shot never tunnels through the capsule.
 */
UCLASS(Blueprintable)
class ENDER_API AEnderEnemyProjectile : public AActor
{
	GENERATED_BODY()

public:
	AEnderEnemyProjectile();

	void Launch(AActor* InSource, const FVector& Start, const FVector& Direction, float InSpeed, float MaxDistance,
		float InRadius, const FEnderDamageParams& InDamage);

	/** Pool use: parks the actor. Also used to cancel shots (boss phase transitions). */
	void Deactivate();

	bool IsInFlight() const { return bInFlight; }
	AActor* GetSource() const { return Source.Get(); }

	virtual void Tick(float DeltaSeconds) override;

protected:
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Projectile") void OnLaunched();
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Projectile") void OnImpact(FVector Location, bool bHitBinder);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Ender|Projectile") TObjectPtr<USphereComponent> Collision;
	UPROPERTY(VisibleAnywhere, Category = "Ender|Projectile") TObjectPtr<UEnderTargetSweepComponent> TargetSweep;

private:
	void End(const FVector& Where, bool bHitBinder);

	TWeakObjectPtr<AActor> Source;
	FEnderDamageParams Damage;
	FVector Direction = FVector::ForwardVector;
	float Speed = 0.f;
	float Remaining = 0.f;
	float Radius = 20.f;
	bool bInFlight = false;
};
