#pragma once

#include "Character/EnderCharacterBase.h"
#include "AI/EnderAITypes.h"
#include "Core/EnderTypes.h"
#include "GameplayTagContainer.h"
#include "EnderEnemyCharacter.generated.h"

class AEnderAIController;
class AEnderCombatDirector;
class AEnderTelegraph;
class UEnderEnemyDefinition;
struct FEnderEnemyAttackSpec;
struct FOnAttributeChangeData;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnEnemyDied, AEnderEnemyCharacter*, Enemy, AActor*, Killer);

/**
 * One of the Hushed. All numbers come from a UEnderEnemyDefinition; behaviour is
 * the attack lifecycle below, which the StateTree drives step by step:
 *
 *   TryAcquireAttackToken → BeginTelegraph → (telegraph resolves) Execute → Recover → None
 *
 * A token is held from before the windup until recovery ends, and is released
 * early on death, stagger, root, and on any aborted attack. Normal enemies only
 * begin while on screen (+8%) and abort instead of executing if they left it.
 *
 * Spawning: SpawnActorDeferred → InitializeEnemy → FinishSpawning. The AI
 * controller is spawned automatically (AutoPossessAI = PlacedInWorldOrSpawned).
 */
UCLASS(Blueprintable)
class ENDER_API AEnderEnemyCharacter : public AEnderCharacterBase
{
	GENERATED_BODY()

public:
	AEnderEnemyCharacter(const FObjectInitializer& ObjectInitializer);

	/** Call between SpawnActorDeferred and FinishSpawning (or before BeginPlay for placed enemies). */
	void InitializeEnemy(const UEnderEnemyDefinition* InDefinition, EEnderEliteModifier InElite);

	UFUNCTION(BlueprintPure, Category = "Ender|Enemy") EEnderArchetype GetArchetype() const;
	UFUNCTION(BlueprintPure, Category = "Ender|Enemy") bool IsElite() const { return EliteModifier != EEnderEliteModifier::None; }
	UFUNCTION(BlueprintPure, Category = "Ender|Enemy") EEnderEliteModifier GetEliteModifier() const { return EliteModifier; }
	const UEnderEnemyDefinition* GetDefinition() const;
	virtual bool IsBoss() const { return false; }

	UPROPERTY(BlueprintAssignable, Category = "Ender|Enemy") FEnderOnEnemyDied OnEnemyDied;

	// ------------------------------------------------------------ AI queries

	/** The Binder, if alive. Cached; returns null when there is nothing to fight. */
	AActor* AcquireTarget();
	AActor* GetCombatTarget() const { return CombatTarget.Get(); }
	float GetDistanceToTarget() const;

	bool IsStaggered() const;
	bool IsRooted() const;
	/** Dead, staggered or rooted: no movement, no new attacks. */
	virtual bool IsDisabled() const;

	/** Holds a preferred band (Wisp, Seer) rather than closing to melee. */
	bool IsRanged() const;
	/** Centre of the preferred band, or a stand-off just inside attack range for melee. */
	virtual float GetDesiredRange() const;
	bool IsInPreferredRange() const;

	/** Heavy when it is off cooldown and in range, else Primary. */
	EEnderAttackSlot ChooseAttackSlot() const;
	bool IsAttackReady(EEnderAttackSlot Slot) const;
	bool IsInAttackRange(EEnderAttackSlot Slot) const;

	// ---------------------------------------------------------- attack steps

	/** Fairness check + token for Slot. On success the slot is committed until the attack ends. */
	bool TryAcquireAttackToken(EEnderAttackSlot Slot);
	bool HasAttackToken() const { return bHoldsToken; }

	/** Starts the windup with the held token: telegraph actor, montage, facing lock. */
	virtual bool BeginTelegraph();

	/** Cancels whatever part of the attack is running and returns the token. Idempotent. */
	virtual void AbortAttack();

	EEnderAttackPhase GetAttackPhase() const { return AttackPhase; }

	/** Reposition/orbit time counts toward the Hound's pre-leap orbit. */
	void NoteOrbiting(float DeltaSeconds) { OrbitSeconds += DeltaSeconds; }

	AEnderAIController* GetEnderAIController() const;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void HandleDeath(AActor* Killer) override;
	virtual void HandleDamaged(const FEnderDamageEvent& Event) override;

	/** Stats, tags, stencil, scale, collision profile. Runs once, at BeginPlay. */
	virtual void ApplyDefinition();

	/** Region for Spec aimed at the current target, clamped by walls for lanes. */
	FEnderTelegraphShape BuildAttackShape(const FEnderEnemyAttackSpec& Spec) const;
	/** Length of a lane from here along Direction, stopped at the first wall. */
	float ClampLaneToWalls(const FVector& Direction, float Range) const;

	/** The telegraph resolved: the single moment the attack lands. */
	void HandleTelegraphResolved(AEnderTelegraph* Telegraph);
	/** Per-archetype hit. Return false if the attack continues past this frame (Hound leap). */
	virtual bool ExecuteAttack(const FEnderEnemyAttackSpec& Spec, const FEnderTelegraphShape& Shape);
	void EnterRecover();
	void FinishAttack();

	/** Damage everything the shape covers, once per target. */
	void ApplyShapeDamage(const FEnderTelegraphShape& Shape, float Damage, EEnderHitWeight Weight, float Stagger = 0.f);
	AEnderTelegraph* SpawnTelegraph(const FEnderTelegraphShape& Shape, float Duration, EEnderTelegraphClass Class);
	FVector GetFeetLocation() const;

	void OnControlTagChanged(const FGameplayTag Tag, int32 NewCount);
	void OnMoveSpeedChanged(const FOnAttributeChangeData& Data);
	void ReleaseToken();

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Enemy") void OnAttackTelegraphed(EEnderAttackSlot Slot, const FEnderTelegraphShape& Shape, float Duration);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Enemy") void OnAttackExecuted(EEnderAttackSlot Slot);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Enemy") void OnAttackAborted();
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Enemy") void OnStaggerChanged(bool bStaggered);

	/** Set for enemies placed in a level; spawned enemies get it from InitializeEnemy. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Enemy") TObjectPtr<UEnderEnemyDefinition> Definition;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Enemy") EEnderEliteModifier EliteModifier = EEnderEliteModifier::None;

	TWeakObjectPtr<AActor> CombatTarget;
	TWeakObjectPtr<AEnderTelegraph> ActiveTelegraph;
	EEnderAttackPhase AttackPhase = EEnderAttackPhase::None;
	EEnderAttackSlot AttackSlot = EEnderAttackSlot::Primary;
	EEnderTokenPool HeldPool = EEnderTokenPool::Melee;
	bool bHoldsToken = false;
	bool bDefinitionApplied = false;
	bool bHasAttacked = false;
	float RecoverLeft = 0.f;
	float TokenIdleSeconds = 0.f;
	float CooldownLeft[2] = {0.f, 0.f};
	float OrbitSeconds = 0.f;

private:
	void TickLeap(float DeltaSeconds);
	void EndLeap();
	void FireProjectile(const FEnderEnemyAttackSpec& Spec, const FEnderTelegraphShape& Shape);
	bool PlaceHazard(const FEnderTelegraphShape& Shape);
	void BeginVolatileExplosion();
	void HandleVolatileResolved(AEnderTelegraph* Telegraph);
	void HandleStaggerThreshold();

	/** Hound leap across its telegraphed lane. */
	FEnderTelegraphShape LeapLane;
	FVector LeapStart = FVector::ZeroVector;
	float LeapElapsed = 0.f;
	float LeapDamage = 0.f;
	bool bLeaping = false;
};
