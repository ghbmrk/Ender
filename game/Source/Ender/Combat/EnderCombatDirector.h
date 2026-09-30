#pragma once

#include "GameFramework/Actor.h"
#include "Core/EnderTypes.h"
#include "Rules/EnemyRules.h"
#include "EnderCombatDirector.generated.h"

class AEnderEnemyCharacter;

/**
 * The attack token director (§ Hushed AI). Caps simultaneous attackers per pool
 * (Melee 4, Ranged 2, Heavy 1) and owns the off-screen fairness rule, so every
 * normal attack passes through here twice: CanBeginAttack before the windup and
 * MayExecuteAttack at the moment damage would land. One per world, spawned on
 * first use. The standalone 100-room simulation (tests/cpp/test_rooms.cpp) calls
 * the same EnderRules functions.
 */
UCLASS(NotPlaceable)
class ENDER_API AEnderCombatDirector : public AActor
{
	GENERATED_BODY()

public:
	AEnderCombatDirector();

	/** Finds the world's director, spawning it in game worlds if there is none. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat", meta = (WorldContext = "WorldContext"))
	static AEnderCombatDirector* Get(const UObject* WorldContext);

	/** Finds without spawning (teardown paths). */
	static AEnderCombatDirector* Find(const UObject* WorldContext);

	/**
	 * May this enemy start a windup now? Normal enemies must be inside the viewport
	 * plus 8% margin (the MVP has no off-screen warnings, so they simply wait).
	 * Bosses always may. False while attacks are suppressed.
	 */
	bool CanBeginAttack(const AEnderEnemyCharacter* Enemy) const;

	/** At execution: a normal enemy off-screen must abort instead of hitting. */
	bool MayExecuteAttack(const AEnderEnemyCharacter* Enemy) const;

	/** Inside the first local player's viewport grown by 8% per side. True when there is no viewer. */
	UFUNCTION(BlueprintPure, Category = "Ender|Combat")
	bool IsWithinFairView(const AActor* Actor) const;

	/** One token per enemy per pool; idempotent for a holder. */
	bool TryAcquireToken(AEnderEnemyCharacter* Enemy, EEnderTokenPool Pool);
	void ReleaseToken(AEnderEnemyCharacter* Enemy, EEnderTokenPool Pool);
	void ReleaseAllTokens(AEnderEnemyCharacter* Enemy);
	bool HoldsToken(const AEnderEnemyCharacter* Enemy, EEnderTokenPool Pool) const;

	UFUNCTION(BlueprintPure, Category = "Ender|Combat")
	int32 GetTokensInUse(EEnderTokenPool Pool) const;

	UFUNCTION(BlueprintPure, Category = "Ender|Combat")
	int32 GetTokenCapacity(EEnderTokenPool Pool) const;

	/**
	 * Player-safe window (boss phase transitions): no token is granted and every
	 * current holder aborts its attack.
	 */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	void SuppressAttacks(float Seconds);

	UFUNCTION(BlueprintPure, Category = "Ender|Combat")
	bool AreAttacksSuppressed() const { return SuppressedLeft > 0.f; }

	/** Drops every token (room reset / encounter end). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	void ResetTokens();

	virtual void Tick(float DeltaSeconds) override;

private:
	static uint32 IdOf(const AEnderEnemyCharacter* Enemy);
	bool ScreenPosition(const AActor* Actor, double& OutU, double& OutV) const;
	void PruneHolders();

	EnderRules::FAttackTokenPools Tokens;
	/** Holder ids back to actors, to drop tokens of enemies destroyed without dying. */
	TMap<uint32, TWeakObjectPtr<AEnderEnemyCharacter>> Holders;
	float SuppressedLeft = 0.f;
};
