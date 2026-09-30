#include "AI/EnderBoundKing.h"

#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "AI/EnderAIController.h"
#include "AI/EnderAIPoolSubsystem.h"
#include "AI/EnderEnemyDefinition.h"
#include "AI/EnderEnemyProjectile.h"
#include "AI/EnderTelegraph.h"
#include "Animation/AnimMontage.h"
#include "Combat/EnderCombatDirector.h"
#include "Combat/EnderCombatStatics.h"
#include "Combat/EnderRunRandomSubsystem.h"
#include "Combat/EnderTargetSweepComponent.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "NavigationSystem.h"
#include "Rules/EnemyAIRules.h"

namespace
{
	EnderRules::EBossAttack ToRules(EEnderBossAttack A) { return static_cast<EnderRules::EBossAttack>(A); }
	static_assert(static_cast<int32>(EEnderBossAttack::None) == EnderRules::NumBossAttacks, "EEnderBossAttack mirrors EnderRules::EBossAttack");
}

AEnderBoundKing::AEnderBoundKing(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
}

bool AEnderBoundKing::IsDisabled() const
{
	return !IsAlive() || !State.CanAct();
}

void AEnderBoundKing::LaunchCharacter(FVector LaunchVelocity, bool bXYOverride, bool bZOverride)
{
	// Bind (and any other knockback) never displaces the Bound King.
}

void AEnderBoundKing::BeginPlay()
{
	if (!Definition)
	{
		// Placed without a Data Asset: run on the rule defaults rather than not at all.
		Definition = NewObject<UEnderEnemyDefinition>(this, TEXT("BoundKingRuleDefaults"), RF_Transient);
		UEnderEnemyDefinition::ApplyRuleDefaults(Definition, EEnderArchetype::BoundKing);
	}
	Super::BeginPlay();
}

void AEnderBoundKing::ApplyDefinition()
{
	const bool bWasApplied = bDefinitionApplied;
	Super::ApplyDefinition();
	UEnderAbilitySystemComponent* ASC = GetEnderASC();
	if (bWasApplied || !bDefinitionApplied || !ASC) return;

	// Health is chosen for a 75–110 s first kill; the derivation is EnderRules::BossTuning.
	float MaxHealth = ASC->GetNumericAttribute(UEnderAttributeSet::GetMaxHealthAttribute());
	if (bTutorial) MaxHealth *= static_cast<float>(EnderRules::BossTuning::TutorialHealthScale);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetMaxHealthAttribute(), MaxHealth);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetHealthAttribute(), MaxHealth);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetMaxStaggerAttribute(), static_cast<float>(EnderRules::BoundKing::StaggerMax));

	State = EnderRules::FBoundKingState();
	State.bTutorial = bTutorial;
	State.MaxHealth = State.Health = MaxHealth;
	BaseMoveSpeed = ASC->GetNumericAttribute(UEnderAttributeSet::GetMoveSpeedAttribute());
	SyncStateToAbilitySystem();
}

void AEnderBoundKing::SyncStateToAbilitySystem()
{
	UEnderAbilitySystemComponent* ASC = GetEnderASC();
	if (!ASC) return;
	// The damage execution reads State.Staggered for the +25% bonus; keep it exactly in step.
	ASC->SetLooseGameplayTagCount(EnderTags::State_Staggered, State.IsStaggered() && IsAlive() ? 1 : 0);
	ASC->SetLooseGameplayTagCount(EnderTags::State_Invulnerable, State.IsInvulnerable() && IsAlive() ? 1 : 0);
	const float Meter = static_cast<float>(State.Stagger);
	if (!FMath::IsNearlyEqual(ASC->GetNumericAttribute(UEnderAttributeSet::GetStaggerAttribute()), Meter, 0.01f))
	{
		ASC->SetNumericAttributeBase(UEnderAttributeSet::GetStaggerAttribute(), Meter);
	}
}

void AEnderBoundKing::HandleDamaged(const FEnderDamageEvent& Event)
{
	// Skips the normal-enemy stagger threshold: the boss meter is the rules state's.
	AEnderCharacterBase::HandleDamaged(Event);
	UEnderAbilitySystemComponent* ASC = GetEnderASC();
	if (!ASC || (Event.HealthLost <= 0.f && Event.StaggerAdded <= 0.f)) return;

	// Replay the hit through the rules. The attribute set already removed the health
	// (including the staggered +25%), so feed the pre-bonus amount back in.
	const double HealthNow = ASC->GetNumericAttribute(UEnderAttributeSet::GetHealthAttribute());
	State.Health = HealthNow + Event.HealthLost;
	const double PreBonus = Event.HealthLost / (1.0 + State.DamageTakenBonus());
	const EnderRules::FBoundKingState::FHitOutcome Outcome = State.ApplyHit(PreBonus, Event.StaggerAdded);
	State.Health = HealthNow;

	// Syncing State.Staggered below fires the base control-tag handler: attack aborted, stagger montage.
	if (Outcome.bStaggerBroke) OnBossStaggerBroken();
	if (Outcome.bSpawnAdds) SpawnAdds();
	if (Outcome.bPhaseChanged) BeginPhaseTransition();
	SyncStateToAbilitySystem();
}

void AEnderBoundKing::BeginPhaseTransition()
{
	// The Binder is safe for the whole 2.0 s: nothing of ours stays live and no enemy may attack.
	AbortAttack();
	if (UEnderAIPoolSubsystem* Pools = UEnderAIPoolSubsystem::Get(this))
	{
		Pools->CancelAllFrom(this);
		Pools->CancelAllProjectiles();
	}
	if (AEnderCombatDirector* Director = AEnderCombatDirector::Get(this))
	{
		Director->SuppressAttacks(static_cast<float>(EnderRules::BoundKing::TransitionDuration));
	}
	if (AEnderAIController* AI = GetEnderAIController()) AI->StopMovement();
	if (PhaseTransitionMontage) PlayAnimMontage(PhaseTransitionMontage);

	if (UEnderAbilitySystemComponent* ASC = GetEnderASC())
	{
		ASC->SetNumericAttributeBase(UEnderAttributeSet::GetMoveSpeedAttribute(), BaseMoveSpeed * static_cast<float>(State.MoveSpeedMul()));
	}
	OnPhaseTransitionStarted(State.Phase);
	OnPhaseChanged.Broadcast(this, State.Phase);
}

void AEnderBoundKing::SpawnAdds()
{
	UWorld* World = GetWorld();
	if (!World) return;
	const UEnderEnemyDefinition* Defs[3] = {HuskDefinition, HuskDefinition, WispDefinition};
	UNavigationSystemV1* Nav = UNavigationSystemV1::GetCurrent<UNavigationSystemV1>(World);
	TArray<AEnderEnemyCharacter*> Spawned;

	int32 Slot = 0;
	for (const UEnderEnemyDefinition* Def : Defs)
	{
		const float Angle = 60.f + 120.f * Slot++;
		if (!Def) continue;
		const FVector Offset = GetActorForwardVector().RotateAngleAxis(Angle, FVector::UpVector) * AddSpawnRadius;
		FVector Location = GetActorLocation() + Offset;
		FNavLocation OnNav;
		if (Nav && Nav->ProjectPointToNavigation(Location, OnNav, FVector(300.f, 300.f, 400.f)))
		{
			Location = OnNav.Location + FVector(0.f, 0.f, GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
		}
		const FTransform Transform((GetActorLocation() - Location).GetSafeNormal2D().Rotation(), Location);
		UClass* Class = Def->EnemyClass ? Def->EnemyClass.Get() : AEnderEnemyCharacter::StaticClass();
		AEnderEnemyCharacter* Add = World->SpawnActorDeferred<AEnderEnemyCharacter>(Class, Transform, nullptr, nullptr,
			ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
		if (!Add) continue;
		Add->InitializeEnemy(Def, EEnderEliteModifier::None);
		Add->FinishSpawning(Transform);
		Spawned.Add(Add);
	}
	OnAddsSpawned.Broadcast(Spawned);
}

// ------------------------------------------------------------------ attacks

AEnderTelegraph* AEnderBoundKing::TelegraphBossShape(const FEnderTelegraphShape& Shape, EnderRules::EBossAttack Attack)
{
	// Telegraph times are the spec's own; attack speed never shortens them (Chain Pull
	// would fall under its 0.80 s floor), it speeds the montages and the recovery.
	const EnderRules::FBossAttackSpec Spec = EnderRules::BossAttack(Attack);
	AEnderTelegraph* Telegraph = SpawnTelegraph(Shape, static_cast<float>(Spec.Telegraph), static_cast<EEnderTelegraphClass>(Spec.Class));
	if (!Telegraph) return nullptr;
	Telegraph->OnResolved.AddUObject(this, &AEnderBoundKing::HandleBossTelegraphResolved);
	BossTelegraphs.Add(Telegraph);
	++PendingResolutions;
	return Telegraph;
}

bool AEnderBoundKing::TryStartBossAttack()
{
	if (IsDisabled() || IsBossAttackActive()) return false;
	AActor* Target = AcquireTarget();
	UEnderRunRandomSubsystem* Random = UEnderRunRandomSubsystem::Get(this);
	if (!Target || !Random) return false;

	const EnderRules::EBossAttack Choice = State.ChooseAttack(GetDistanceToTarget(), Random->Stream(EnderRules::Stream::BossPattern));
	if (Choice == EnderRules::EBossAttack::Count) return false;

	State.BeginAttack(Choice);
	CurrentAttack = static_cast<EEnderBossAttack>(Choice);
	AttackElapsed = 0.f;
	RecoveryLeft = -1.f;
	PendingResolutions = 0;
	CollapseLanesStarted = 0;
	BossTelegraphs.Reset();

	using namespace EnderRules::BossGeometry;
	const FVector Feet = GetFeetLocation();
	const FVector Dir = (Target->GetActorLocation() - GetActorLocation()).GetSafeNormal2D(UE_SMALL_NUMBER, GetActorForwardVector());
	const ACharacter* TargetCharacter = Cast<ACharacter>(Target);
	FVector TargetFeet = Target->GetActorLocation();
	if (TargetCharacter) TargetFeet.Z -= TargetCharacter->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();

	switch (Choice)
	{
	case EnderRules::EBossAttack::Sweep:
		TelegraphBossShape(FEnderTelegraphShape::MakeCone(Feet, Dir, static_cast<float>(SweepRange), static_cast<float>(SweepArc)), Choice);
		break;
	case EnderRules::EBossAttack::InkLance:
		TelegraphBossShape(FEnderTelegraphShape::MakeLane(Feet, Dir, ClampLaneToWalls(Dir, LanceLength), static_cast<float>(LanceWidth)), Choice);
		break;
	case EnderRules::EBossAttack::BoundCircle:
		TelegraphBossShape(FEnderTelegraphShape::MakeCircle(TargetFeet, static_cast<float>(CircleRadius)), Choice);
		break;
	case EnderRules::EBossAttack::ChainPull:
		TelegraphBossShape(FEnderTelegraphShape::MakeLane(Feet, Dir, ClampLaneToWalls(Dir, ChainLength), ChainWidth), Choice);
		break;
	case EnderRules::EBossAttack::ManuscriptCollapse:
		CollapseForward = Dir;
		CollapseAnchor = TargetFeet;
		StartCollapseLane(0);
		break;
	default:
		break;
	}

	if (PendingResolutions == 0)
	{
		// Telegraph pool exhausted: never attack without a telegraph.
		EndBossAttack();
		return false;
	}

	if (AEnderAIController* AI = GetEnderAIController()) AI->LockFacing(Dir);
	if (const TObjectPtr<UAnimMontage>* Montage = AttackMontages.Find(CurrentAttack); Montage && *Montage)
	{
		PlayAnimMontage(*Montage, static_cast<float>(State.AttackSpeedMul()));
	}
	OnBossAttackStarted(CurrentAttack);
	return true;
}

void AEnderBoundKing::StartCollapseLane(int32 Index)
{
	// Lanes run toward the Binder, side by side, rolling from one flank to the other.
	const FVector Side(-CollapseForward.Y, CollapseForward.X, 0.f);
	const float Offset = (Index - 1) * CollapseLaneSpacing;
	const FVector Origin = CollapseAnchor + Side * Offset - CollapseForward * (CollapseLaneLength * 0.5f);
	TelegraphBossShape(FEnderTelegraphShape::MakeLane(Origin, CollapseForward, CollapseLaneLength,
		static_cast<float>(EnderRules::BossGeometry::CollapseLaneWidth)), EnderRules::EBossAttack::ManuscriptCollapse);
	++CollapseLanesStarted;
}

void AEnderBoundKing::HandleBossTelegraphResolved(AEnderTelegraph* Telegraph)
{
	if (CurrentAttack == EEnderBossAttack::None || !BossTelegraphs.Contains(Telegraph)) return;
	--PendingResolutions;

	const EnderRules::FBossAttackSpec Spec = EnderRules::BossAttack(ToRules(CurrentAttack));
	const FEnderTelegraphShape Shape = Telegraph->GetShape();
	const float Damage = static_cast<float>(Spec.Damage);

	switch (CurrentAttack)
	{
	case EEnderBossAttack::InkLance:
		if (UEnderAIPoolSubsystem* Pools = UEnderAIPoolSubsystem::Get(this))
		{
			if (AEnderEnemyProjectile* Lance = Pools->AcquireProjectile())
			{
				FEnderDamageParams Params;
				Params.BaseDamage = Damage;
				Params.bCanCrit = false;
				const FVector Start = Shape.Origin + FVector(0.f, 0.f, GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
				Lance->Launch(this, Start, Shape.Direction, static_cast<float>(EnderRules::BossGeometry::LanceSpeed), Shape.Length, Shape.Width * 0.5f, Params);
			}
		}
		break;
	case EEnderBossAttack::ChainPull:
		if (TargetSweep)
		{
			FEnderDamageParams Params;
			Params.BaseDamage = Damage;
			Params.bCanCrit = false;
			TargetSweep->BeginExecution();
			for (const FHitResult& Hit : Shape.Query(TargetSweep))
			{
				ACharacter* Victim = Cast<ACharacter>(Hit.GetActor());
				// Evade invulnerability slips the chain entirely: no damage, no pull.
				if (!Victim || UEnderCombatStatics::HasTag(Victim, EnderTags::State_Invulnerable) || UEnderCombatStatics::HasTag(Victim, EnderTags::State_Evading)) continue;
				UEnderCombatStatics::ApplyDamage(this, Victim, Params, Hit);
				const FVector ToBoss = (GetActorLocation() - Victim->GetActorLocation()).GetSafeNormal2D();
				const float Gap = static_cast<float>(FVector::Dist2D(GetActorLocation(), Victim->GetActorLocation()))
					- GetCapsuleComponent()->GetScaledCapsuleRadius() - Victim->GetCapsuleComponent()->GetScaledCapsuleRadius() - 20.f;
				PullVictim = Victim;
				PullStart = Victim->GetActorLocation();
				PullEnd = PullStart + ToBoss * FMath::Clamp(Gap, 0.f, static_cast<float>(EnderRules::BossGeometry::ChainPullDistance));
				PullElapsed = 0.f;
			}
			TargetSweep->EndExecution();
		}
		break;
	default: // Sweep, Bound Circle, each Manuscript Collapse lane
		ApplyShapeDamage(Shape, Damage, EEnderHitWeight::Heavy);
		break;
	}

	const bool bAllLanesOut = CurrentAttack != EEnderBossAttack::ManuscriptCollapse || CollapseLanesStarted >= EnderRules::BossGeometry::CollapseLanes;
	if (PendingResolutions <= 0 && bAllLanesOut)
	{
		RecoveryLeft = FMath::Max(0.2f, static_cast<float>((Spec.Duration - Spec.Telegraph) / State.AttackSpeedMul()));
	}
}

void AEnderBoundKing::TickChainPull(float DeltaSeconds)
{
	if (PullElapsed < 0.f) return;
	ACharacter* Victim = PullVictim.Get();
	// An evade that starts mid-pull breaks the chain.
	if (!Victim || UEnderCombatStatics::HasTag(Victim, EnderTags::State_Invulnerable) || UEnderCombatStatics::HasTag(Victim, EnderTags::State_Evading))
	{
		PullElapsed = -1.f;
		PullVictim.Reset();
		return;
	}
	PullElapsed += DeltaSeconds;
	const float Alpha = FMath::Clamp(PullElapsed / FMath::Max(0.05f, ChainPullSeconds), 0.f, 1.f);
	FVector Goal = FMath::Lerp(PullStart, PullEnd, Alpha);
	Goal.Z = Victim->GetActorLocation().Z;
	Victim->SetActorLocation(Goal, true);
	if (Alpha >= 1.f)
	{
		PullElapsed = -1.f;
		PullVictim.Reset();
	}
}

void AEnderBoundKing::EndBossAttack()
{
	if (CurrentAttack == EEnderBossAttack::None) return;
	State.EndAttack(ToRules(CurrentAttack));
	CurrentAttack = EEnderBossAttack::None;
	PendingResolutions = 0;
	RecoveryLeft = -1.f;
	BossTelegraphs.Reset();
	if (AEnderAIController* AI = GetEnderAIController()) AI->UnlockFacing();
}

void AEnderBoundKing::AbortAttack()
{
	for (const TWeakObjectPtr<AEnderTelegraph>& Weak : BossTelegraphs)
	{
		if (AEnderTelegraph* Telegraph = Weak.Get(); Telegraph && Telegraph->GetSource() == this) Telegraph->Cancel();
	}
	PullElapsed = -1.f;
	PullVictim.Reset();
	if (CurrentAttack != EEnderBossAttack::None)
	{
		StopAnimMontage();
		EndBossAttack();
	}
	Super::AbortAttack();
}

void AEnderBoundKing::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!IsAlive()) return;

	State.Tick(DeltaSeconds);
	SyncStateToAbilitySystem();
	TickChainPull(DeltaSeconds);

	if (CurrentAttack == EEnderBossAttack::None) return;
	AttackElapsed += DeltaSeconds;

	if (CurrentAttack == EEnderBossAttack::ManuscriptCollapse)
	{
		using namespace EnderRules::BossGeometry;
		while (CollapseLanesStarted < CollapseLanes && AttackElapsed >= CollapseLanesStarted * CollapseLaneDelay)
		{
			StartCollapseLane(CollapseLanesStarted);
		}
	}

	if (PendingResolutions <= 0 && RecoveryLeft >= 0.f)
	{
		RecoveryLeft -= DeltaSeconds;
		if (RecoveryLeft <= 0.f) EndBossAttack();
	}
}

void AEnderBoundKing::HandleDeath(AActor* Killer)
{
	AbortAttack();
	if (UEnderAIPoolSubsystem* Pools = UEnderAIPoolSubsystem::Get(this)) Pools->CancelAllFrom(this);
	Super::HandleDeath(Killer);
	SyncStateToAbilitySystem();
	OnBossDefeated.Broadcast(this);
}
