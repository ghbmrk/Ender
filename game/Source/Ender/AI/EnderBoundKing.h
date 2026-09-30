#pragma once

#include "AI/EnderEnemyCharacter.h"
#include "Rules/BossRules.h"
#include "EnderBoundKing.generated.h"

class AEnderBoundKing;
class UAnimMontage;

UENUM(BlueprintType)
enum class EEnderBossAttack : uint8
{
	Sweep,
	InkLance,
	BoundCircle,
	ChainPull,
	ManuscriptCollapse,
	None,
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnBossDefeated, AEnderBoundKing*, Boss);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnBossPhaseChanged, AEnderBoundKing*, Boss, int32, NewPhase);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FEnderOnBossAddsSpawned, const TArray<AEnderEnemyCharacter*>&, Adds);

/**
 * The Bound King. An AEnderEnemyCharacter so the encounter code spawns, tracks and
 * hears about it like any enemy (InitializeEnemy, OnEnemyDied); boss-only rules
 * live in EnderRules::FBoundKingState, which is the single source of truth for
 * phase, stagger and attack availability:
 *
 *   Health    the attribute set applies damage (with the +25% staggered bonus);
 *             each hit is replayed into the rules state to get phase/stagger/adds.
 *   Stagger   the rules meter; mirrored to the Stagger attribute for the UI.
 *   Tags      State.Staggered and State.Invulnerable follow the rules state each tick.
 *
 * Boss attacks need no tokens and are exempt from the off-screen rule. Choices
 * draw from the run's BossPattern stream. Phase transitions (2.0 s) cancel boss
 * attacks and suppress every enemy attack, so the Binder is safe. Tutorial fights
 * stop at Phase 2.
 */
UCLASS(Blueprintable)
class ENDER_API AEnderBoundKing : public AEnderEnemyCharacter
{
	GENERATED_BODY()

public:
	AEnderBoundKing(const FObjectInitializer& ObjectInitializer);

	virtual bool IsBoss() const override { return true; }
	virtual bool IsDisabled() const override;

	/** Phases 1–2 only. Set before FinishSpawning. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ender|Boss", meta = (ExposeOnSpawn = "true")) bool bTutorial = false;

	UPROPERTY(BlueprintAssignable, Category = "Ender|Boss") FEnderOnBossDefeated OnBossDefeated;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Boss") FEnderOnBossPhaseChanged OnPhaseChanged;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Boss") FEnderOnBossAddsSpawned OnAddsSpawned;

	UFUNCTION(BlueprintPure, Category = "Ender|Boss") int32 GetPhase() const { return State.Phase; }
	UFUNCTION(BlueprintPure, Category = "Ender|Boss") float GetStaggerMeter() const { return static_cast<float>(State.Stagger); }
	UFUNCTION(BlueprintPure, Category = "Ender|Boss") bool IsTransitioning() const { return State.IsTransitioning(); }
	UFUNCTION(BlueprintPure, Category = "Ender|Boss") EEnderBossAttack GetCurrentBossAttack() const { return CurrentAttack; }

	/** StateTree: picks and starts the next attack. False when none is ready or the boss cannot act. */
	bool TryStartBossAttack();
	bool IsBossAttackActive() const { return CurrentAttack != EEnderBossAttack::None; }
	/** Stand-off the boss approaches to between attacks (inside Sweep reach). */
	float GetEngageRange() const { return static_cast<float>(EnderRules::BossGeometry::SweepRange) * 0.8f; }
	virtual float GetDesiredRange() const override { return GetEngageRange(); }

	virtual void AbortAttack() override;

	const EnderRules::FBoundKingState& GetBossState() const { return State; }

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void ApplyDefinition() override;
	virtual void HandleDamaged(const FEnderDamageEvent& Event) override;
	virtual void HandleDeath(AActor* Killer) override;
	/** Bind on a boss: no displacement. */
	virtual void LaunchCharacter(FVector LaunchVelocity, bool bXYOverride, bool bZOverride) override;

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Boss") void OnBossAttackStarted(EEnderBossAttack Attack);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Boss") void OnBossStaggerBroken();
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|Boss") void OnPhaseTransitionStarted(int32 NewPhase);

	/** Adds spawned once at 80% health: two Husks and one Wisp. */
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Adds") TObjectPtr<UEnderEnemyDefinition> HuskDefinition;
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Adds") TObjectPtr<UEnderEnemyDefinition> WispDefinition;
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Adds", meta = (Units = "cm")) float AddSpawnRadius = 450.f;

	/** Ink Lance / Chain Pull reach; Manuscript Collapse lane length and spacing. Spec leaves these open. */
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Shapes", meta = (Units = "cm")) float LanceLength = 1600.f;
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Shapes", meta = (Units = "cm")) float ChainLength = 1100.f;
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Shapes", meta = (Units = "cm")) float ChainWidth = 90.f;
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Shapes", meta = (Units = "cm")) float CollapseLaneLength = 1800.f;
	/** Centre-to-centre; 300 leaves a 100 cm safe strip between 200 cm lanes. */
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Shapes", meta = (Units = "cm")) float CollapseLaneSpacing = 300.f;
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Shapes", meta = (Units = "s")) float ChainPullSeconds = 0.2f;

	/** Montage per attack, indexed by EEnderBossAttack. */
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Cues") TMap<EEnderBossAttack, TObjectPtr<UAnimMontage>> AttackMontages;
	UPROPERTY(EditAnywhere, Category = "Ender|Boss|Cues") TObjectPtr<UAnimMontage> PhaseTransitionMontage;

private:
	void SyncStateToAbilitySystem();
	void BeginPhaseTransition();
	void SpawnAdds();
	void EndBossAttack();

	AEnderTelegraph* TelegraphBossShape(const FEnderTelegraphShape& Shape, EnderRules::EBossAttack Attack);
	void HandleBossTelegraphResolved(AEnderTelegraph* Telegraph);
	void StartCollapseLane(int32 Index);
	void TickChainPull(float DeltaSeconds);

	EnderRules::FBoundKingState State;
	EEnderBossAttack CurrentAttack = EEnderBossAttack::None;
	TArray<TWeakObjectPtr<AEnderTelegraph>> BossTelegraphs;
	int32 PendingResolutions = 0;
	float RecoveryLeft = 0.f;
	float AttackElapsed = 0.f;
	int32 CollapseLanesStarted = 0;
	FVector CollapseForward = FVector::ForwardVector;
	FVector CollapseAnchor = FVector::ZeroVector;
	float BaseMoveSpeed = 0.f;

	TWeakObjectPtr<ACharacter> PullVictim;
	FVector PullStart = FVector::ZeroVector;
	FVector PullEnd = FVector::ZeroVector;
	float PullElapsed = -1.f;
};
