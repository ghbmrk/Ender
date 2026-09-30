#pragma once

#include "StateTreeConditionBase.h"
#include "StateTreeTaskBase.h"
#include "EnderStateTreeTasks.generated.h"

class AEnderEnemyCharacter;

/*
 * StateTree nodes for the Hushed and the Bound King. Each is a thin step over
 * AEnderEnemyCharacter / AEnderAIController methods, so the behaviour is readable
 * in C++ and the tree only decides order (Content/AI/STATETREE_LAYOUT.md).
 * Every node binds its Actor to the tree's context actor automatically.
 */

USTRUCT()
struct ENDER_API FEnderSTEnemyInstanceData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, Category = "Context") TObjectPtr<AActor> Actor = nullptr;
};

USTRUCT()
struct ENDER_API FEnderSTTimedInstanceData : public FEnderSTEnemyInstanceData
{
	GENERATED_BODY()

	float Elapsed = 0.f;
	float Duration = 0.f;
};

/** Finds the Binder. Running until there is one. */
USTRUCT(meta = (DisplayName = "Ender Acquire Target", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_AcquireTarget : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTEnemyInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
};

USTRUCT()
struct ENDER_API FEnderSTApproachInstanceData : public FEnderSTTimedInstanceData
{
	GENERATED_BODY()

	/** Multiplies the enemy's desired range (attack stand-off, or the boss engage range). */
	UPROPERTY(EditAnywhere, Category = "Parameter", meta = (ClampMin = "0.1")) float RangeScale = 1.f;
	/** Succeed anyway after this long; 0 = no limit. */
	UPROPERTY(EditAnywhere, Category = "Parameter", meta = (ClampMin = "0")) float MaxSeconds = 0.f;
};

/** Paths toward the Binder until inside the desired range. */
USTRUCT(meta = (DisplayName = "Ender Approach", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_Approach : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTApproachInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
	virtual void ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
};

USTRUCT()
struct ENDER_API FEnderSTMaintainRangeInstanceData : public FEnderSTTimedInstanceData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, Category = "Parameter", meta = (ClampMin = "0")) float MaxSeconds = 3.f;
};

/** Ranged enemies: settle inside the preferred band with sight of the Binder. Melee succeeds at once. */
USTRUCT(meta = (DisplayName = "Ender Maintain Range", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_MaintainRange : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTMaintainRangeInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
	virtual void ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
};

USTRUCT()
struct ENDER_API FEnderSTRequestTokenInstanceData : public FEnderSTTimedInstanceData
{
	GENERATED_BODY()

	/** Hold and threaten this long waiting for a token, then fail (→ Reposition). */
	UPROPERTY(EditAnywhere, Category = "Parameter", meta = (ClampMin = "0")) float MaxWaitSeconds = 0.4f;
};

/**
 * Asks the combat director for a token for the chosen attack (with the off-screen
 * check). Succeeds holding it; fails when out of range or after MaxWaitSeconds.
 */
USTRUCT(meta = (DisplayName = "Ender Request Attack Token", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_RequestAttackToken : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTRequestTokenInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
};

/** Starts the windup; Running until the telegraph resolves. Leaving early aborts and frees the token. */
USTRUCT(meta = (DisplayName = "Ender Telegraph", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_Telegraph : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTEnemyInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
	virtual void ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
};

/** Running while the attack lands (instant for strikes, the whole leap for Hounds). */
USTRUCT(meta = (DisplayName = "Ender Execute", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_Execute : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTEnemyInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
	virtual void ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
};

/** Running through recovery; the token returns when it ends (or when this state is left early). */
USTRUCT(meta = (DisplayName = "Ender Recover", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_Recover : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTEnemyInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
	virtual void ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
};

USTRUCT()
struct ENDER_API FEnderSTRepositionInstanceData : public FEnderSTTimedInstanceData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, Category = "Parameter", meta = (ClampMin = "0")) float MinSeconds = 0.6f;
	UPROPERTY(EditAnywhere, Category = "Parameter", meta = (ClampMin = "0")) float MaxSeconds = 1.2f;
	/** Melee enemies circle this far outside their stand-off so token holders have room. */
	UPROPERTY(EditAnywhere, Category = "Parameter") float MeleeExtraRadius = 120.f;
};

/** Circles the Binder without a token (the "orbit / threaten" of the spec). Counts toward the Hound's pre-leap orbit. */
USTRUCT(meta = (DisplayName = "Ender Reposition", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_Reposition : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTRepositionInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
	virtual void ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
};

/** Rooted / Staggered / Dead: stands still, Running until the enemy can act again. */
USTRUCT(meta = (DisplayName = "Ender Disabled", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_Disabled : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTEnemyInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
};

/** Bound King: choose (BossPattern stream) and run one attack. Fails when none is ready. */
USTRUCT(meta = (DisplayName = "Ender Boss Attack", Category = "Ender|AI"))
struct ENDER_API FEnderSTTask_BossAttack : public FStateTreeTaskCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTEnemyInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual EStateTreeRunStatus EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
	virtual EStateTreeRunStatus Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const override;
	virtual void ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const override;
};

UENUM()
enum class EEnderEnemyCheck : uint8
{
	HasTarget,
	Dead,
	Staggered,
	Rooted,
	Disabled,
	Ranged,
	InPreferredRange,
	InAttackRange,
	AttackReady,
	HoldsToken,
	Attacking,
	Boss,
	BossTransitioning,
};

USTRUCT()
struct ENDER_API FEnderSTEnemyConditionInstanceData : public FEnderSTEnemyInstanceData
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, Category = "Parameter") EEnderEnemyCheck Check = EEnderEnemyCheck::HasTarget;
	UPROPERTY(EditAnywhere, Category = "Parameter") bool bInvert = false;
};

/** One condition for every enemy query the tree needs. InAttackRange/AttackReady use the slot the enemy would choose now. */
USTRUCT(meta = (DisplayName = "Ender Enemy Check", Category = "Ender|AI"))
struct ENDER_API FEnderSTCondition_Enemy : public FStateTreeConditionCommonBase
{
	GENERATED_BODY()
	using FInstanceDataType = FEnderSTEnemyConditionInstanceData;
	virtual const UStruct* GetInstanceDataType() const override { return FInstanceDataType::StaticStruct(); }
	virtual bool TestCondition(FStateTreeExecutionContext& Context) const override;
};
