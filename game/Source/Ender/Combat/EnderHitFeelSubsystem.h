#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "Core/EnderTypes.h"
#include "EnderHitFeelSubsystem.generated.h"

class AEnderCharacterBase;

/**
 * §32 hit feel. Normal hits flash and kick the camera; heavy hits also pause the
 * victim's animation locally; only a critical heavy hit (28 ms) or an ultimate's
 * first impact (42 ms) stops world time. Global hitstop dilates world time only:
 * UMG and audio keep running because neither reads world time dilation.
 * Overlapping hitstops take the longest remaining, never stack.
 */
UCLASS()
class ENDER_API UEnderHitFeelSubsystem : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	/** Called by the Binder's damage-dealt path for every successful hit. */
	void PlayHit(AEnderCharacterBase* Victim, EEnderHitWeight Weight, bool bCrit, bool bFirstUltimateImpact, const FVector& HitDirection);

	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UEnderHitFeelSubsystem, STATGROUP_Tickables); }
	virtual bool IsTickableWhenPaused() const override { return true; }

private:
	double HitstopEndsRealTime = 0.0;
	bool bHitstopActive = false;
	static constexpr float HitstopDilation = 0.0001f;
};
