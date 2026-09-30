#include "AI/EnderEnemyCharacter.h"

#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "AI/EnderAIController.h"
#include "AI/EnderAIPoolSubsystem.h"
#include "AI/EnderEnemyDefinition.h"
#include "AI/EnderEnemyProjectile.h"
#include "AI/EnderHazardPool.h"
#include "AI/EnderTelegraph.h"
#include "Animation/AnimMontage.h"
#include "Combat/EnderCombatDirector.h"
#include "Combat/EnderCombatStatics.h"
#include "Combat/EnderTargetSweepComponent.h"
#include "Components/CapsuleComponent.h"
#include "Ender.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameplayEffectTypes.h"
#include "Kismet/GameplayStatics.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraSystem.h"
#include "Rules/EnemyAIRules.h"
#include "Rules/EnemyRules.h"
#include "Sound/SoundBase.h"

namespace
{
	/** After an aborted attack (off-screen, cap reached) wait before asking again. */
	constexpr float AbortRetryDelay = 0.35f;
	/** A token nobody turns into a windup goes back to the director. */
	constexpr float IdleTokenSeconds = 0.5f;
	/** Tuning, not spec: elites shrug off twice the stagger of their normal form. */
	constexpr float EliteStaggerThresholdMul = 2.f;

	int32 SlotIndex(EEnderAttackSlot Slot) { return Slot == EEnderAttackSlot::Heavy ? 1 : 0; }
}

AEnderEnemyCharacter::AEnderEnemyCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	PrimaryActorTick.bCanEverTick = true;
	AIControllerClass = AEnderAIController::StaticClass();
	AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;
	bUseControllerRotationYaw = false;

	if (UCharacterMovementComponent* Move = GetCharacterMovement())
	{
		// Turn toward the controller's focus (the Binder, or the locked attack direction).
		Move->bOrientRotationToMovement = false;
		Move->bUseControllerDesiredRotation = true;
		Move->RotationRate = FRotator(0.f, 540.f, 0.f);
	}
	GetCapsuleComponent()->SetCollisionProfileName(TEXT("EnderEnemy"));
	if (TargetSweep) TargetSweep->Team = EEnderSweepTeam::Player;
}

void AEnderEnemyCharacter::InitializeEnemy(const UEnderEnemyDefinition* InDefinition, EEnderEliteModifier InElite)
{
	Definition = const_cast<UEnderEnemyDefinition*>(InDefinition);
	EliteModifier = InElite;
	if (HasActorBegunPlay()) ApplyDefinition();
}

EEnderArchetype AEnderEnemyCharacter::GetArchetype() const
{
	return Definition ? Definition->Archetype : EEnderArchetype::Husk;
}

const UEnderEnemyDefinition* AEnderEnemyCharacter::GetDefinition() const
{
	return Definition;
}

AEnderAIController* AEnderEnemyCharacter::GetEnderAIController() const
{
	return Cast<AEnderAIController>(GetController());
}

void AEnderEnemyCharacter::BeginPlay()
{
	Super::BeginPlay();
	if (TargetSweep) TargetSweep->Team = EEnderSweepTeam::Player;
	ApplyDefinition();

	if (UEnderAbilitySystemComponent* ASC = GetEnderASC())
	{
		for (const FGameplayTag& Tag : {EnderTags::State_Staggered.GetTag(), EnderTags::State_Rooted.GetTag(), EnderTags::Effect_Root.GetTag()})
		{
			ASC->RegisterGameplayTagEvent(Tag, EGameplayTagEventType::NewOrRemoved).AddUObject(this, &AEnderEnemyCharacter::OnControlTagChanged);
		}
		ASC->GetGameplayAttributeValueChangeDelegate(UEnderAttributeSet::GetMoveSpeedAttribute()).AddUObject(this, &AEnderEnemyCharacter::OnMoveSpeedChanged);
	}
}

void AEnderEnemyCharacter::ApplyDefinition()
{
	UEnderAbilitySystemComponent* ASC = GetEnderASC();
	if (bDefinitionApplied || !Definition || !ASC) return;
	bDefinitionApplied = true;

	float MaxHealth = Definition->MaxHealth;
	float Armor = Definition->Armor;
	float StaggerThreshold = Definition->StaggerThreshold;
	if (EliteModifier == EEnderEliteModifier::Hardened)
	{
		MaxHealth *= static_cast<float>(EnderRules::Elite::HardenedHealthMul);
		Armor += static_cast<float>(EnderRules::Elite::HardenedArmorAdd);
		SetActorScale3D(GetActorScale3D() * static_cast<float>(EnderRules::Elite::HardenedScale));
	}
	if (IsElite()) StaggerThreshold *= EliteStaggerThresholdMul;

	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetMaxHealthAttribute(), MaxHealth);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetHealthAttribute(), MaxHealth);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetArmorAttribute(), Armor);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetMoveSpeedAttribute(), Definition->MoveSpeed);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetAttackPowerAttribute(), 1.f);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetCritChanceAttribute(), 0.f);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetMaxStaggerAttribute(), StaggerThreshold);
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetStaggerAttribute(), 0.f);

	const FGameplayTag Rank = IsBoss() ? EnderTags::Enemy_Boss.GetTag() : (IsElite() ? EnderTags::Enemy_Elite.GetTag() : EnderTags::Enemy_Normal.GetTag());
	ASC->SetLooseGameplayTagCount(Rank, 1);
	SetOutlineStencil(IsBoss() ? EnderStencil::Boss : (IsElite() ? EnderStencil::Elite : EnderStencil::Enemy));

	GetCapsuleComponent()->SetCollisionProfileName(Definition->bBlocksEnemyProjectiles ? FName(TEXT("EnderKeeper")) : FName(TEXT("EnderEnemy")));
	GetCharacterMovement()->MaxWalkSpeed = ASC->GetNumericAttribute(UEnderAttributeSet::GetMoveSpeedAttribute());

	if (Definition->SpawnNiagara)
	{
		UNiagaraFunctionLibrary::SpawnSystemAtLocation(this, Definition->SpawnNiagara, GetFeetLocation(), GetActorRotation());
	}
}

void AEnderEnemyCharacter::EndPlay(const EEndPlayReason::Type Reason)
{
	AbortAttack();
	if (AEnderCombatDirector* Director = AEnderCombatDirector::Find(this)) Director->ReleaseAllTokens(this);
	Super::EndPlay(Reason);
}

void AEnderEnemyCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	for (float& C : CooldownLeft) C = FMath::Max(0.f, C - DeltaSeconds);

	if (bLeaping) TickLeap(DeltaSeconds);

	if (AttackPhase == EEnderAttackPhase::Recover)
	{
		RecoverLeft -= DeltaSeconds;
		if (RecoverLeft <= 0.f) FinishAttack();
	}

	// A token held without a windup (the tree moved on) must not starve the others.
	if (bHoldsToken && AttackPhase == EEnderAttackPhase::None)
	{
		TokenIdleSeconds += DeltaSeconds;
		if (TokenIdleSeconds >= IdleTokenSeconds) ReleaseToken();
	}
}

// ------------------------------------------------------------------ queries

AActor* AEnderEnemyCharacter::AcquireTarget()
{
	AActor* Current = CombatTarget.Get();
	if (Current && UEnderCombatStatics::IsAlive(Current)) return Current;
	CombatTarget.Reset();
	APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	if (Player && UEnderCombatStatics::IsAlive(Player)) CombatTarget = Player;
	return CombatTarget.Get();
}

float AEnderEnemyCharacter::GetDistanceToTarget() const
{
	const AActor* Target = CombatTarget.Get();
	return Target ? static_cast<float>(FVector::Dist2D(GetActorLocation(), Target->GetActorLocation())) : TNumericLimits<float>::Max();
}

bool AEnderEnemyCharacter::IsStaggered() const
{
	return UEnderCombatStatics::HasTag(this, EnderTags::State_Staggered);
}

bool AEnderEnemyCharacter::IsRooted() const
{
	return UEnderCombatStatics::HasTag(this, EnderTags::State_Rooted) || UEnderCombatStatics::HasTag(this, EnderTags::Effect_Root);
}

bool AEnderEnemyCharacter::IsDisabled() const
{
	return !IsAlive() || IsStaggered() || IsRooted();
}

bool AEnderEnemyCharacter::IsRanged() const
{
	return Definition && Definition->PreferredRangeMax > 0.f;
}

float AEnderEnemyCharacter::GetDesiredRange() const
{
	if (!Definition) return 150.f;
	if (IsRanged()) return 0.5f * (Definition->PreferredRangeMin + Definition->PreferredRangeMax);
	return Definition->PrimaryAttack.Range * 0.8f;
}

bool AEnderEnemyCharacter::IsInPreferredRange() const
{
	if (!IsRanged()) return IsInAttackRange(EEnderAttackSlot::Primary);
	const float Dist = GetDistanceToTarget();
	constexpr float Slack = 75.f; // matches AEnderAIController::MaintainRange
	return Dist >= Definition->PreferredRangeMin - Slack && Dist <= Definition->PreferredRangeMax + Slack;
}

EEnderAttackSlot AEnderEnemyCharacter::ChooseAttackSlot() const
{
	if (Definition && Definition->bHasHeavyAttack && IsAttackReady(EEnderAttackSlot::Heavy) && IsInAttackRange(EEnderAttackSlot::Heavy))
	{
		return EEnderAttackSlot::Heavy;
	}
	return EEnderAttackSlot::Primary;
}

bool AEnderEnemyCharacter::IsAttackReady(EEnderAttackSlot Slot) const
{
	if (!Definition) return false;
	if (Slot == EEnderAttackSlot::Heavy && !Definition->bHasHeavyAttack) return false;
	if (CooldownLeft[SlotIndex(Slot)] > 0.f) return false;
	// Hound: circle the Binder before the first leap so it never opens from a blind straight line.
	if (!bHasAttacked && OrbitSeconds < Definition->MinOrbitBeforeFirstAttack) return false;

	const FEnderEnemyAttackSpec& Spec = Definition->GetAttack(Slot);
	const UEnderAIPoolSubsystem* Pools = UEnderAIPoolSubsystem::Get(this);
	if (Spec.Delivery == EEnderAttackDelivery::Hazard && Pools && Pools->CountLiveHazards(this) >= Definition->MaxHazardPools) return false;
	if (Spec.Delivery == EEnderAttackDelivery::Projectile && Pools && Pools->CountProjectilesInFlight() >= EnderRules::EnemyLimits::MaxEnemyProjectiles) return false;
	return true;
}

bool AEnderEnemyCharacter::IsInAttackRange(EEnderAttackSlot Slot) const
{
	const AActor* Target = CombatTarget.Get();
	if (!Definition || !Target) return false;
	const FEnderEnemyAttackSpec& Spec = Definition->GetAttack(Slot);
	const ACharacter* TargetCharacter = Cast<ACharacter>(Target);
	const float TargetRadius = TargetCharacter ? TargetCharacter->GetCapsuleComponent()->GetScaledCapsuleRadius() : 0.f;
	if (GetDistanceToTarget() - TargetRadius > Spec.Range) return false;
	if (Spec.Delivery != EEnderAttackDelivery::Strike)
	{
		const AController* MyController = GetController();
		return MyController && MyController->LineOfSightTo(Target);
	}
	return true;
}

// ------------------------------------------------------------ attack steps

bool AEnderEnemyCharacter::TryAcquireAttackToken(EEnderAttackSlot Slot)
{
	if (!Definition || IsDisabled() || AttackPhase != EEnderAttackPhase::None) return false;
	if (bHoldsToken)
	{
		if (AttackSlot == Slot) return true;
		ReleaseToken();
	}
	if (!IsAttackReady(Slot)) return false;

	AEnderCombatDirector* Director = AEnderCombatDirector::Get(this);
	if (!Director || !Director->CanBeginAttack(this)) return false;
	const EEnderTokenPool Pool = Definition->GetAttack(Slot).TokenPool;
	if (!Director->TryAcquireToken(this, Pool)) return false;

	bHoldsToken = true;
	HeldPool = Pool;
	AttackSlot = Slot;
	TokenIdleSeconds = 0.f;
	return true;
}

void AEnderEnemyCharacter::ReleaseToken()
{
	if (!bHoldsToken) return;
	bHoldsToken = false;
	if (AEnderCombatDirector* Director = AEnderCombatDirector::Find(this)) Director->ReleaseToken(this, HeldPool);
}

FVector AEnderEnemyCharacter::GetFeetLocation() const
{
	return GetActorLocation() - FVector(0.f, 0.f, GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
}

FEnderTelegraphShape AEnderEnemyCharacter::BuildAttackShape(const FEnderEnemyAttackSpec& Spec) const
{
	const FVector Feet = GetFeetLocation();
	const AActor* Target = CombatTarget.Get();
	const FVector ToTarget = Target ? (Target->GetActorLocation() - GetActorLocation()) * FVector(1.f, 1.f, 0.f) : GetActorForwardVector();
	const FVector Dir = ToTarget.GetSafeNormal2D(UE_SMALL_NUMBER, GetActorForwardVector());

	switch (Spec.Shape)
	{
	case EEnderTelegraphShape::Circle:
	{
		FVector Center = Feet;
		if (Spec.bPlaceAtTarget && Target)
		{
			const ACharacter* TargetCharacter = Cast<ACharacter>(Target);
			const float HalfHeight = TargetCharacter ? TargetCharacter->GetCapsuleComponent()->GetScaledCapsuleHalfHeight() : 0.f;
			Center = Feet + Dir * FMath::Min(static_cast<float>(ToTarget.Size2D()), Spec.Range);
			Center.Z = Target->GetActorLocation().Z - HalfHeight;
		}
		return FEnderTelegraphShape::MakeCircle(Center, Spec.Radius);
	}
	case EEnderTelegraphShape::Lane:
	{
		return FEnderTelegraphShape::MakeLane(Feet, Dir, ClampLaneToWalls(Dir, Spec.Range), Spec.Width);
	}
	default:
		return FEnderTelegraphShape::MakeCone(Feet, Dir, Spec.Range, Spec.ArcDegrees);
	}
}

float AEnderEnemyCharacter::ClampLaneToWalls(const FVector& Direction, float Range) const
{
	// Lanes stop at walls, so the drawn line is exactly where the leap or shot can go.
	FHitResult Wall;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(EnderLaneClamp), false, this);
	const FVector Start = GetActorLocation();
	if (GetWorld()->LineTraceSingleByObjectType(Wall, Start, Start + Direction.GetSafeNormal2D() * Range,
		FCollisionObjectQueryParams(ECC_WorldStatic), Params))
	{
		return FMath::Max(0.f, static_cast<float>(FVector::Dist2D(Start, Wall.ImpactPoint)));
	}
	return Range;
}

AEnderTelegraph* AEnderEnemyCharacter::SpawnTelegraph(const FEnderTelegraphShape& Shape, float Duration, EEnderTelegraphClass Class)
{
	UEnderAIPoolSubsystem* Pools = UEnderAIPoolSubsystem::Get(this);
	AEnderTelegraph* Telegraph = Pools ? Pools->AcquireTelegraph() : nullptr;
	if (!Telegraph) return nullptr;
	const float Effective = static_cast<float>(EnderRules::TelegraphLook::EffectiveDuration(Duration, EnderConvert::ToRules(Class)));
	Telegraph->Begin(Shape, Effective, this);
	return Telegraph;
}

bool AEnderEnemyCharacter::BeginTelegraph()
{
	if (!Definition || AttackPhase != EEnderAttackPhase::None || IsDisabled()) return false;
	if (!bHoldsToken) return false;

	AEnderCombatDirector* Director = AEnderCombatDirector::Get(this);
	if (!AcquireTarget() || !Director || !Director->CanBeginAttack(this))
	{
		ReleaseToken();
		return false;
	}

	const FEnderEnemyAttackSpec& Spec = Definition->GetAttack(AttackSlot);
	const FEnderTelegraphShape Shape = BuildAttackShape(Spec);
	AEnderTelegraph* Telegraph = SpawnTelegraph(Shape, Spec.TelegraphSeconds, Spec.TelegraphClass);
	if (!Telegraph)
	{
		ReleaseToken();
		CooldownLeft[SlotIndex(AttackSlot)] = FMath::Max(CooldownLeft[SlotIndex(AttackSlot)], AbortRetryDelay);
		return false;
	}
	Telegraph->OnResolved.AddUObject(this, &AEnderEnemyCharacter::HandleTelegraphResolved);
	Telegraph->SetHoldAfterActivation(Spec.Delivery == EEnderAttackDelivery::Leap);
	ActiveTelegraph = Telegraph;
	AttackPhase = EEnderAttackPhase::Telegraph;

	if (UEnderAbilitySystemComponent* ASC = GetEnderASC()) ASC->SetLooseGameplayTagCount(EnderTags::State_Attacking, 1);
	if (AEnderAIController* AI = GetEnderAIController()) AI->LockFacing(Shape.Direction);

	const float Duration = Telegraph->GetDuration();
	if (Spec.WindupMontage)
	{
		// The windup animation ends on the frame the telegraph resolves.
		PlayAnimMontage(Spec.WindupMontage, FMath::Max(0.1f, Spec.WindupMontage->GetPlayLength() / FMath::Max(0.05f, Duration)));
	}
	if (Spec.WindupSound) UGameplayStatics::PlaySoundAtLocation(this, Spec.WindupSound, GetActorLocation());
	OnAttackTelegraphed(AttackSlot, Shape, Duration);
	return true;
}

void AEnderEnemyCharacter::HandleTelegraphResolved(AEnderTelegraph* Telegraph)
{
	if (Telegraph != ActiveTelegraph.Get() || AttackPhase != EEnderAttackPhase::Telegraph || !Definition) return;

	// No normal attack may land from off-screen: abort and hand the token back instead.
	const AEnderCombatDirector* Director = AEnderCombatDirector::Find(this);
	if (IsDisabled() || (!IsBoss() && (!Director || !Director->MayExecuteAttack(this))))
	{
		AbortAttack();
		return;
	}

	const FEnderEnemyAttackSpec& Spec = Definition->GetAttack(AttackSlot);
	const FEnderTelegraphShape Shape = Telegraph->GetShape();
	AttackPhase = EEnderAttackPhase::Execute;
	if (Spec.ExecuteMontage) PlayAnimMontage(Spec.ExecuteMontage);
	if (Spec.ExecuteSound) UGameplayStatics::PlaySoundAtLocation(this, Spec.ExecuteSound, GetActorLocation());
	if (Spec.ExecuteNiagara) UNiagaraFunctionLibrary::SpawnSystemAtLocation(this, Spec.ExecuteNiagara, Shape.DrawCenter(), Shape.Direction.Rotation());
	OnAttackExecuted(AttackSlot);

	if (ExecuteAttack(Spec, Shape)) EnterRecover();
}

bool AEnderEnemyCharacter::ExecuteAttack(const FEnderEnemyAttackSpec& Spec, const FEnderTelegraphShape& Shape)
{
	switch (Spec.Delivery)
	{
	case EEnderAttackDelivery::Leap:
		LeapLane = Shape;
		LeapStart = GetActorLocation();
		LeapElapsed = 0.f;
		LeapDamage = Spec.Damage;
		bLeaping = true;
		GetCharacterMovement()->StopMovementImmediately();
		GetCharacterMovement()->SetMovementMode(MOVE_Flying);
		if (TargetSweep) TargetSweep->BeginExecution();
		return false;
	case EEnderAttackDelivery::Projectile:
		FireProjectile(Spec, Shape);
		return true;
	case EEnderAttackDelivery::Hazard:
		PlaceHazard(Shape);
		return true;
	default:
		ApplyShapeDamage(Shape, Spec.Damage, Spec.HitWeight);
		return true;
	}
}

void AEnderEnemyCharacter::ApplyShapeDamage(const FEnderTelegraphShape& Shape, float Damage, EEnderHitWeight Weight, float Stagger)
{
	if (!TargetSweep) return;
	FEnderDamageParams Params;
	Params.BaseDamage = Damage;
	Params.Stagger = Stagger;
	Params.HitWeight = Weight;
	Params.bCanCrit = false;
	TargetSweep->BeginExecution();
	for (const FHitResult& Hit : Shape.Query(TargetSweep))
	{
		UEnderCombatStatics::ApplyDamage(this, Hit.GetActor(), Params, Hit);
	}
	TargetSweep->EndExecution();
}

void AEnderEnemyCharacter::TickLeap(float DeltaSeconds)
{
	LeapElapsed += DeltaSeconds;
	const float Duration = FMath::Max(0.05f, Definition ? Definition->LeapSeconds : 0.28f);
	const float Alpha = FMath::Clamp(LeapElapsed / Duration, 0.f, 1.f);
	const float Radius = GetCapsuleComponent()->GetScaledCapsuleRadius();
	// The body stays inside the drawn lane: the centre stops one radius short of its end.
	const float Travel = FMath::Max(0.f, LeapLane.Length - Radius);

	FHitResult Block;
	SetActorLocation(LeapStart + LeapLane.Direction * (Travel * Alpha), true, &Block);
	const float Covered = static_cast<float>(FVector::Dist2D(LeapStart, GetActorLocation()));

	// Damage region: the part of the telegraphed lane the Hound's body has crossed so far.
	if (TargetSweep)
	{
		FEnderDamageParams Params;
		Params.BaseDamage = LeapDamage;
		Params.bCanCrit = false;
		const float Reach = FMath::Min(LeapLane.Length, Covered + Radius + 10.f);
		for (const FHitResult& Hit : TargetSweep->LaneQuery(LeapLane.Origin, LeapLane.Direction, Reach, LeapLane.Width))
		{
			UEnderCombatStatics::ApplyDamage(this, Hit.GetActor(), Params, Hit);
		}
	}

	if (Alpha >= 1.f || Block.bBlockingHit)
	{
		EndLeap();
		EnterRecover();
	}
}

void AEnderEnemyCharacter::EndLeap()
{
	if (!bLeaping) return;
	bLeaping = false;
	GetCharacterMovement()->SetMovementMode(MOVE_Walking);
	if (TargetSweep) TargetSweep->EndExecution();
	if (AEnderTelegraph* Telegraph = ActiveTelegraph.Get(); Telegraph && Telegraph->GetSource() == this) Telegraph->Release();
}

void AEnderEnemyCharacter::FireProjectile(const FEnderEnemyAttackSpec& Spec, const FEnderTelegraphShape& Shape)
{
	UEnderAIPoolSubsystem* Pools = UEnderAIPoolSubsystem::Get(this);
	AEnderEnemyProjectile* Projectile = Pools ? Pools->AcquireProjectile() : nullptr;
	if (!Projectile || !Definition) return; // cap reached between windup and release: the shot fizzles
	FEnderDamageParams Params;
	Params.BaseDamage = Spec.Damage;
	Params.HitWeight = Spec.HitWeight;
	Params.bCanCrit = false;
	const FVector Start = Shape.Origin + FVector(0.f, 0.f, GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
	Projectile->Launch(this, Start, Shape.Direction, Definition->ProjectileSpeed, Shape.Length, Shape.Width * 0.5f, Params);
}

bool AEnderEnemyCharacter::PlaceHazard(const FEnderTelegraphShape& Shape)
{
	UEnderAIPoolSubsystem* Pools = UEnderAIPoolSubsystem::Get(this);
	AEnderHazardPool* Hazard = Pools ? Pools->AcquireHazard() : nullptr;
	if (!Hazard || !Definition) return false;
	Hazard->Begin(this, Shape.Origin, Shape.Radius, Definition->HazardActivationDelay, Definition->HazardDuration, Definition->HazardDamagePerSecond);
	return true;
}

void AEnderEnemyCharacter::EnterRecover()
{
	if (!Definition) return;
	const FEnderEnemyAttackSpec& Spec = Definition->GetAttack(AttackSlot);
	AttackPhase = EEnderAttackPhase::Recover;
	RecoverLeft = Spec.RecoverySeconds;
	CooldownLeft[SlotIndex(AttackSlot)] = Spec.CooldownSeconds;
	bHasAttacked = true;
	if (RecoverLeft <= 0.f) FinishAttack();
}

void AEnderEnemyCharacter::FinishAttack()
{
	AttackPhase = EEnderAttackPhase::None;
	ReleaseToken();
	if (AEnderTelegraph* Telegraph = ActiveTelegraph.Get(); Telegraph && Telegraph->GetSource() == this) Telegraph->Release();
	ActiveTelegraph.Reset();
	if (UEnderAbilitySystemComponent* ASC = GetEnderASC()) ASC->SetLooseGameplayTagCount(EnderTags::State_Attacking, 0);
	if (AEnderAIController* AI = GetEnderAIController()) AI->UnlockFacing();
}

void AEnderEnemyCharacter::AbortAttack()
{
	const bool bWasAttacking = AttackPhase != EEnderAttackPhase::None;
	if (bLeaping) EndLeap();
	if (AEnderTelegraph* Telegraph = ActiveTelegraph.Get(); Telegraph && Telegraph->GetSource() == this) Telegraph->Cancel();
	ActiveTelegraph.Reset();
	AttackPhase = EEnderAttackPhase::None;
	ReleaseToken();
	if (!bWasAttacking) return;

	StopAnimMontage();
	CooldownLeft[SlotIndex(AttackSlot)] = FMath::Max(CooldownLeft[SlotIndex(AttackSlot)], AbortRetryDelay);
	if (UEnderAbilitySystemComponent* ASC = GetEnderASC()) ASC->SetLooseGameplayTagCount(EnderTags::State_Attacking, 0);
	if (AEnderAIController* AI = GetEnderAIController()) AI->UnlockFacing();
	OnAttackAborted();
}

// ------------------------------------------------------- damage, control, death

void AEnderEnemyCharacter::HandleDamaged(const FEnderDamageEvent& Event)
{
	Super::HandleDamaged(Event);
	if (!IsAlive()) return;
	if (Event.StaggerAdded > 0.f) HandleStaggerThreshold();
	if (AttackPhase == EEnderAttackPhase::None && !IsStaggered() && Definition && Definition->HitReactMontage)
	{
		PlayAnimMontage(Definition->HitReactMontage);
	}
}

void AEnderEnemyCharacter::HandleStaggerThreshold()
{
	UEnderAbilitySystemComponent* ASC = GetEnderASC();
	if (!ASC || !Definition || IsStaggered()) return;
	const float Stagger = ASC->GetNumericAttribute(UEnderAttributeSet::GetStaggerAttribute());
	const float Threshold = ASC->GetNumericAttribute(UEnderAttributeSet::GetMaxStaggerAttribute());
	if (Threshold <= 0.f || Stagger < Threshold) return;
	ASC->SetNumericAttributeBase(UEnderAttributeSet::GetStaggerAttribute(), 0.f);
	UEnderCombatStatics::ApplyStatusTag(this, this, EnderTags::State_Staggered, Definition->StaggerSeconds);
}

void AEnderEnemyCharacter::OnControlTagChanged(const FGameplayTag Tag, int32 NewCount)
{
	// Bind on a boss never displaces or roots it; its stagger is driven by the boss rules.
	if (IsBoss() && Tag != EnderTags::State_Staggered) return;
	const bool bStaggerTag = Tag == EnderTags::State_Staggered;
	if (NewCount > 0)
	{
		AbortAttack();
		if (AEnderAIController* AI = GetEnderAIController()) AI->StopMovement();
		if (bStaggerTag)
		{
			if (Definition && Definition->StaggerMontage) PlayAnimMontage(Definition->StaggerMontage);
			OnStaggerChanged(true);
		}
	}
	else if (bStaggerTag)
	{
		OnStaggerChanged(false);
	}
}

void AEnderEnemyCharacter::OnMoveSpeedChanged(const FOnAttributeChangeData& Data)
{
	GetCharacterMovement()->MaxWalkSpeed = FMath::Max(0.f, Data.NewValue);
}

void AEnderEnemyCharacter::HandleDeath(AActor* Killer)
{
	AbortAttack();
	if (AEnderCombatDirector* Director = AEnderCombatDirector::Find(this)) Director->ReleaseAllTokens(this);
	if (AEnderAIController* AI = GetEnderAIController()) AI->StopBrain(TEXT("Dead"));

	Super::HandleDeath(Killer);

	if (EliteModifier == EEnderEliteModifier::Volatile) BeginVolatileExplosion();
	if (Definition && Definition->DeathSound) UGameplayStatics::PlaySoundAtLocation(this, Definition->DeathSound, GetActorLocation());
	OnEnemyDied.Broadcast(this, Killer);
}

void AEnderEnemyCharacter::BeginVolatileExplosion()
{
	// Telegraphed at death; the corpse lives 3 s, so it is still here when this resolves at 0.85 s.
	const FEnderTelegraphShape Shape = FEnderTelegraphShape::MakeCircle(GetFeetLocation(), static_cast<float>(EnderRules::Elite::VolatileRadius));
	if (AEnderTelegraph* Telegraph = SpawnTelegraph(Shape, static_cast<float>(EnderRules::Elite::VolatileTelegraph), EEnderTelegraphClass::DangerZone))
	{
		Telegraph->OnResolved.AddUObject(this, &AEnderEnemyCharacter::HandleVolatileResolved);
	}
}

void AEnderEnemyCharacter::HandleVolatileResolved(AEnderTelegraph* Telegraph)
{
	if (!Telegraph || Telegraph->GetSource() != this) return;
	ApplyShapeDamage(Telegraph->GetShape(), static_cast<float>(EnderRules::Elite::VolatileDamage), EEnderHitWeight::Heavy);
}
