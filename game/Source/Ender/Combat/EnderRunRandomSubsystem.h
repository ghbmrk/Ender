#pragma once

#include "Subsystems/WorldSubsystem.h"
#include "Rules/RunRandom.h"
#include "EnderRunRandomSubsystem.generated.h"

/**
 * One seed per Realm run; every gameplay random draw comes from a named stream
 * derived from it (§30 crits, loot, composition, spawns, boss patterns). The
 * reality service issues the seed with the run so a run replays exactly.
 */
UCLASS()
class ENDER_API UEnderRunRandomSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|Run")
	void BeginRun(int64 Seed);

	UFUNCTION(BlueprintPure, Category = "Ender|Run")
	int64 GetRunSeed() const { return static_cast<int64>(RunSeed); }

	/** Stream access for C++ systems. Streams persist for the run so draws never repeat. */
	EnderRules::FRunRandom& Stream(uint64 StreamId);

	/** Convenience for Blueprints: uniform [0,1) from a stream. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Run")
	float DrawUnit(int32 StreamId) { return static_cast<float>(Stream(static_cast<uint64>(StreamId)).NextUnit()); }

	static UEnderRunRandomSubsystem* Get(const UObject* WorldContext);

private:
	uint64 RunSeed = 0x0E4DE5ull;
	TMap<uint64, EnderRules::FRunRandom> Streams;
};
