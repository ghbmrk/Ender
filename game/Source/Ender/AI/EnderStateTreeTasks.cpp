#include "AI/EnderStateTreeTasks.h"

#include "AI/EnderAIController.h"
#include "AI/EnderBoundKing.h"
#include "AI/EnderEnemyCharacter.h"
#include "AI/EnderEnemyDefinition.h"
#include "Combat/EnderRunRandomSubsystem.h"
#include "StateTreeExecutionContext.h"

namespace
{
	AEnderEnemyCharacter* EnemyOf(const FEnderSTEnemyInstanceData& Data)
	{
		return Cast<AEnderEnemyCharacter>(Data.Actor);
	}

	AEnderAIController* ControllerOf(const AEnderEnemyCharacter* Enemy)
	{
		return Enemy ? Enemy->GetEnderAIController() : nullptr;
	}

	/** Phase-driven status shared by the attack steps: Running while in Phase, Succeeded once past it. */
	EStateTreeRunStatus StatusForPhase(const AEnderEnemyCharacter* Enemy, EEnderAttackPhase Phase)
	{
		if (!Enemy) return EStateTreeRunStatus::Failed;
		const EEnderAttackPhase Now = Enemy->GetAttackPhase();
		if (Now == Phase) return EStateTreeRunStatus::Running;
		if (Now == EEnderAttackPhase::None) return Phase == EEnderAttackPhase::Recover ? EStateTreeRunStatus::Succeeded : EStateTreeRunStatus::Failed;
		return static_cast<uint8>(Now) > static_cast<uint8>(Phase) ? EStateTreeRunStatus::Succeeded : EStateTreeRunStatus::Failed;
	}
}

// ---------------------------------------------------------- acquire target

EStateTreeRunStatus FEnderSTTask_AcquireTarget::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	return Tick(Context, 0.f);
}

EStateTreeRunStatus FEnderSTTask_AcquireTarget::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	AEnderEnemyCharacter* Enemy = EnemyOf(Context.GetInstanceData(*this));
	if (!Enemy) return EStateTreeRunStatus::Failed;
	return Enemy->AcquireTarget() ? EStateTreeRunStatus::Succeeded : EStateTreeRunStatus::Running;
}

// ------------------------------------------------------------------ approach

EStateTreeRunStatus FEnderSTTask_Approach::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	Context.GetInstanceData(*this).Elapsed = 0.f;
	return Tick(Context, 0.f);
}

EStateTreeRunStatus FEnderSTTask_Approach::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	FInstanceDataType& Data = Context.GetInstanceData(*this);
	AEnderEnemyCharacter* Enemy = EnemyOf(Data);
	AEnderAIController* AI = ControllerOf(Enemy);
	if (!AI || !Enemy->AcquireTarget()) return EStateTreeRunStatus::Failed;

	Data.Elapsed += DeltaTime;
	if (AI->ApproachTarget(Enemy->GetDesiredRange() * Data.RangeScale)) return EStateTreeRunStatus::Succeeded;
	if (Data.MaxSeconds > 0.f && Data.Elapsed >= Data.MaxSeconds) return EStateTreeRunStatus::Succeeded;
	return EStateTreeRunStatus::Running;
}

void FEnderSTTask_Approach::ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	if (AEnderAIController* AI = ControllerOf(EnemyOf(Context.GetInstanceData(*this)))) AI->StopMovement();
}

// ------------------------------------------------------------ maintain range

EStateTreeRunStatus FEnderSTTask_MaintainRange::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	Context.GetInstanceData(*this).Elapsed = 0.f;
	return Tick(Context, 0.f);
}

EStateTreeRunStatus FEnderSTTask_MaintainRange::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	FInstanceDataType& Data = Context.GetInstanceData(*this);
	AEnderEnemyCharacter* Enemy = EnemyOf(Data);
	AEnderAIController* AI = ControllerOf(Enemy);
	if (!AI || !Enemy->AcquireTarget()) return EStateTreeRunStatus::Failed;
	if (!Enemy->IsRanged()) return EStateTreeRunStatus::Succeeded;

	Data.Elapsed += DeltaTime;
	const UEnderEnemyDefinition* Def = Enemy->GetDefinition();
	if (AI->MaintainRange(Def->PreferredRangeMin, Def->PreferredRangeMax)) return EStateTreeRunStatus::Succeeded;
	return Data.MaxSeconds > 0.f && Data.Elapsed >= Data.MaxSeconds ? EStateTreeRunStatus::Succeeded : EStateTreeRunStatus::Running;
}

void FEnderSTTask_MaintainRange::ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	if (AEnderAIController* AI = ControllerOf(EnemyOf(Context.GetInstanceData(*this)))) AI->StopMovement();
}

// ------------------------------------------------------------ request token

EStateTreeRunStatus FEnderSTTask_RequestAttackToken::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	Context.GetInstanceData(*this).Elapsed = 0.f;
	return Tick(Context, 0.f);
}

EStateTreeRunStatus FEnderSTTask_RequestAttackToken::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	FInstanceDataType& Data = Context.GetInstanceData(*this);
	AEnderEnemyCharacter* Enemy = EnemyOf(Data);
	if (!Enemy || Enemy->IsDisabled() || !Enemy->AcquireTarget()) return EStateTreeRunStatus::Failed;

	const EEnderAttackSlot Slot = Enemy->ChooseAttackSlot();
	if (!Enemy->IsInAttackRange(Slot)) return EStateTreeRunStatus::Failed;
	if (Enemy->TryAcquireAttackToken(Slot)) return EStateTreeRunStatus::Succeeded;

	// No token (or off-screen, or orbit/cooldown gate): hold ground facing the Binder.
	if (AEnderAIController* AI = ControllerOf(Enemy)) AI->FaceTarget();
	Data.Elapsed += DeltaTime;
	return Data.Elapsed >= Data.MaxWaitSeconds ? EStateTreeRunStatus::Failed : EStateTreeRunStatus::Running;
}

// ------------------------------------------------- telegraph / execute / recover

EStateTreeRunStatus FEnderSTTask_Telegraph::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	AEnderEnemyCharacter* Enemy = EnemyOf(Context.GetInstanceData(*this));
	return Enemy && Enemy->BeginTelegraph() ? EStateTreeRunStatus::Running : EStateTreeRunStatus::Failed;
}

EStateTreeRunStatus FEnderSTTask_Telegraph::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	return StatusForPhase(EnemyOf(Context.GetInstanceData(*this)), EEnderAttackPhase::Telegraph);
}

void FEnderSTTask_Telegraph::ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	AEnderEnemyCharacter* Enemy = EnemyOf(Context.GetInstanceData(*this));
	if (Enemy && Enemy->GetAttackPhase() == EEnderAttackPhase::Telegraph) Enemy->AbortAttack();
}

EStateTreeRunStatus FEnderSTTask_Execute::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	return StatusForPhase(EnemyOf(Context.GetInstanceData(*this)), EEnderAttackPhase::Execute);
}

EStateTreeRunStatus FEnderSTTask_Execute::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	return StatusForPhase(EnemyOf(Context.GetInstanceData(*this)), EEnderAttackPhase::Execute);
}

void FEnderSTTask_Execute::ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	AEnderEnemyCharacter* Enemy = EnemyOf(Context.GetInstanceData(*this));
	if (Enemy && Enemy->GetAttackPhase() == EEnderAttackPhase::Execute) Enemy->AbortAttack();
}

EStateTreeRunStatus FEnderSTTask_Recover::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	return StatusForPhase(EnemyOf(Context.GetInstanceData(*this)), EEnderAttackPhase::Recover);
}

EStateTreeRunStatus FEnderSTTask_Recover::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	return StatusForPhase(EnemyOf(Context.GetInstanceData(*this)), EEnderAttackPhase::Recover);
}

void FEnderSTTask_Recover::ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	// Interrupted mid-recovery: the token still goes back.
	AEnderEnemyCharacter* Enemy = EnemyOf(Context.GetInstanceData(*this));
	if (Enemy && Enemy->GetAttackPhase() == EEnderAttackPhase::Recover) Enemy->AbortAttack();
}

// --------------------------------------------------------------- reposition

EStateTreeRunStatus FEnderSTTask_Reposition::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	FInstanceDataType& Data = Context.GetInstanceData(*this);
	AEnderEnemyCharacter* Enemy = EnemyOf(Data);
	if (!Enemy) return EStateTreeRunStatus::Failed;
	Data.Elapsed = 0.f;
	double Unit = 0.5;
	if (UEnderRunRandomSubsystem* Random = UEnderRunRandomSubsystem::Get(Enemy)) Unit = Random->Stream(EnderRules::Stream::AI).NextUnit();
	Data.Duration = FMath::Lerp(Data.MinSeconds, FMath::Max(Data.MinSeconds, Data.MaxSeconds), static_cast<float>(Unit));
	return EStateTreeRunStatus::Running;
}

EStateTreeRunStatus FEnderSTTask_Reposition::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	FInstanceDataType& Data = Context.GetInstanceData(*this);
	AEnderEnemyCharacter* Enemy = EnemyOf(Data);
	AEnderAIController* AI = ControllerOf(Enemy);
	if (!AI || !Enemy->AcquireTarget()) return EStateTreeRunStatus::Failed;

	const float Radius = FMath::Max(200.f, Enemy->GetDesiredRange() + (Enemy->IsRanged() ? 0.f : Data.MeleeExtraRadius));
	AI->OrbitTarget(Radius, DeltaTime);
	Enemy->NoteOrbiting(DeltaTime);
	Data.Elapsed += DeltaTime;
	return Data.Elapsed >= Data.Duration ? EStateTreeRunStatus::Succeeded : EStateTreeRunStatus::Running;
}

void FEnderSTTask_Reposition::ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	if (AEnderAIController* AI = ControllerOf(EnemyOf(Context.GetInstanceData(*this)))) AI->StopMovement();
}

// ----------------------------------------------------------------- disabled

EStateTreeRunStatus FEnderSTTask_Disabled::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	AEnderEnemyCharacter* Enemy = EnemyOf(Context.GetInstanceData(*this));
	if (!Enemy) return EStateTreeRunStatus::Failed;
	Enemy->AbortAttack();
	if (AEnderAIController* AI = ControllerOf(Enemy)) AI->StopMovement();
	return EStateTreeRunStatus::Running;
}

EStateTreeRunStatus FEnderSTTask_Disabled::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	const AEnderEnemyCharacter* Enemy = EnemyOf(Context.GetInstanceData(*this));
	if (!Enemy) return EStateTreeRunStatus::Failed;
	return Enemy->IsDisabled() ? EStateTreeRunStatus::Running : EStateTreeRunStatus::Succeeded;
}

// -------------------------------------------------------------- boss attack

EStateTreeRunStatus FEnderSTTask_BossAttack::EnterState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	AEnderBoundKing* Boss = Cast<AEnderBoundKing>(Context.GetInstanceData(*this).Actor);
	return Boss && Boss->TryStartBossAttack() ? EStateTreeRunStatus::Running : EStateTreeRunStatus::Failed;
}

EStateTreeRunStatus FEnderSTTask_BossAttack::Tick(FStateTreeExecutionContext& Context, const float DeltaTime) const
{
	const AEnderBoundKing* Boss = Cast<AEnderBoundKing>(Context.GetInstanceData(*this).Actor);
	if (!Boss) return EStateTreeRunStatus::Failed;
	return Boss->IsBossAttackActive() ? EStateTreeRunStatus::Running : EStateTreeRunStatus::Succeeded;
}

void FEnderSTTask_BossAttack::ExitState(FStateTreeExecutionContext& Context, const FStateTreeTransitionResult& Transition) const
{
	AEnderBoundKing* Boss = Cast<AEnderBoundKing>(Context.GetInstanceData(*this).Actor);
	if (Boss && Boss->IsBossAttackActive()) Boss->AbortAttack();
}

// ---------------------------------------------------------------- condition

bool FEnderSTCondition_Enemy::TestCondition(FStateTreeExecutionContext& Context) const
{
	const FInstanceDataType& Data = Context.GetInstanceData(*this);
	AEnderEnemyCharacter* Enemy = EnemyOf(Data);
	bool bResult = false;
	if (Enemy)
	{
		switch (Data.Check)
		{
		case EEnderEnemyCheck::HasTarget: bResult = Enemy->AcquireTarget() != nullptr; break;
		case EEnderEnemyCheck::Dead: bResult = !Enemy->IsAlive(); break;
		case EEnderEnemyCheck::Staggered: bResult = Enemy->IsStaggered(); break;
		case EEnderEnemyCheck::Rooted: bResult = Enemy->IsRooted(); break;
		case EEnderEnemyCheck::Disabled: bResult = Enemy->IsDisabled(); break;
		case EEnderEnemyCheck::Ranged: bResult = Enemy->IsRanged(); break;
		case EEnderEnemyCheck::InPreferredRange: bResult = Enemy->IsInPreferredRange(); break;
		case EEnderEnemyCheck::InAttackRange: bResult = Enemy->IsInAttackRange(Enemy->ChooseAttackSlot()); break;
		case EEnderEnemyCheck::AttackReady: bResult = Enemy->IsAttackReady(Enemy->ChooseAttackSlot()); break;
		case EEnderEnemyCheck::HoldsToken: bResult = Enemy->HasAttackToken(); break;
		case EEnderEnemyCheck::Attacking: bResult = Enemy->GetAttackPhase() != EEnderAttackPhase::None; break;
		case EEnderEnemyCheck::Boss: bResult = Enemy->IsBoss(); break;
		case EEnderEnemyCheck::BossTransitioning:
			if (const AEnderBoundKing* Boss = Cast<AEnderBoundKing>(Enemy)) bResult = Boss->IsTransitioning();
			break;
		}
	}
	return bResult != Data.bInvert;
}
