#include "Character/EnderPlayerCharacter.h"

#include "Ender.h"
#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Camera/CameraComponent.h"
#include "Camera/EnderCameraRigComponent.h"
#include "Combat/EnderCombatInputBuffer.h"
#include "Combat/EnderCombatStatics.h"
#include "Combat/EnderHitFeelSubsystem.h"
#include "Combat/EnderRunRandomSubsystem.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Inventory/EnderInventoryComponent.h"
#include "MotionWarpingComponent.h"
#include "Rules/CombatRules.h"
#include "Rules/ControllerFeelRules.h"

AEnderPlayerCharacter::AEnderPlayerCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	namespace B = EnderRules::Binder;
	GetCapsuleComponent()->InitCapsuleSize(B::CapsuleRadius, B::CapsuleHeight * 0.5f);
	GetCapsuleComponent()->SetCollisionProfileName(TEXT("EnderPlayer"));

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->MaxWalkSpeed = B::MaxSpeed;
	Move->MaxAcceleration = B::Acceleration;
	Move->BrakingDecelerationWalking = B::Deceleration;
	// Braking is pure deceleration; friction would add a speed-dependent term on top.
	Move->bUseSeparateBrakingFriction = true;
	Move->BrakingFriction = 0.f;
	Move->GroundFriction = 12.f;

	SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
	SpringArm->SetupAttachment(RootComponent);
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(SpringArm, USpringArmComponent::SocketName);
	CameraRig = CreateDefaultSubobject<UEnderCameraRigComponent>(TEXT("CameraRig"));
	InputBuffer = CreateDefaultSubobject<UEnderCombatInputBuffer>(TEXT("InputBuffer"));
	MotionWarping = CreateDefaultSubobject<UMotionWarpingComponent>(TEXT("MotionWarping"));

	OutlineStencil = EnderStencil::Player;
	TargetSweep->Team = EEnderSweepTeam::Enemies;
}

void AEnderPlayerCharacter::BeginPlay()
{
	CameraRig->Setup(SpringArm, Camera);
	Super::BeginPlay();
	AimPoint = GetActorLocation() + GetActorForwardVector() * 300.f;
	DraughtCharges = MaxDraughtCharges;
	AbilitySystem->OnDealtDamageNative.AddUObject(this, &AEnderPlayerCharacter::OnDealtDamage);
	AbilitySystem->RegisterGameplayTagEvent(EnderTags::Effect_Barrier, EGameplayTagEventType::NewOrRemoved)
		.AddUObject(this, &AEnderPlayerCharacter::OnBarrierTagChanged);
	ResetThreadForRoom();
	// Gear bonuses sit on attribute bases, so reapply now rather than on the inventory's next tick.
	if (UEnderInventoryComponent* Inventory = UEnderInventoryComponent::FindFor(this)) Inventory->ReapplyGear();
}

void AEnderPlayerCharacter::SetAimPoint(const FVector& WorldPoint)
{
	AimPoint = WorldPoint;
	CameraRig->SetAimPoint(WorldPoint);
}

void AEnderPlayerCharacter::FaceDirection(const FVector& Direction)
{
	const FVector D = Direction.GetSafeNormal2D();
	if (!D.IsNearlyZero()) SetActorRotation(D.Rotation());
}

float AEnderPlayerCharacter::GetBaseMoveSpeed() const
{
	return AbilitySystem->GetNumericAttribute(UEnderAttributeSet::GetMoveSpeedAttribute());
}

void AEnderPlayerCharacter::NotifyAbilityActivated(const FGameplayTag& AbilityTag)
{
	if (AbilityTag != EnderTags::Ability_Basic_ThreadLash) bLashChainBroken = true;
}

bool AEnderPlayerCharacter::ConsumeLashChainBreak()
{
	const bool bWas = bLashChainBroken;
	bLashChainBroken = false;
	return bWas;
}

void AEnderPlayerCharacter::ResetThreadForRoom()
{
	AbilitySystem->SetNumericAttributeBase(UEnderAttributeSet::GetThreadAttribute(), EnderRules::Thread::RoomStart);
}

bool AEnderPlayerCharacter::ConsumeDraughtCharge()
{
	if (DraughtCharges <= 0) return false;
	--DraughtCharges;
	OnDraughtsChanged.Broadcast(DraughtCharges, MaxDraughtCharges);
	return true;
}

void AEnderPlayerCharacter::RestoreDraughtCharge()
{
	if (DraughtCharges >= MaxDraughtCharges) return;
	++DraughtCharges;
	OnDraughtsChanged.Broadcast(DraughtCharges, MaxDraughtCharges);
}

void AEnderPlayerCharacter::RefillDraughts()
{
	DraughtCharges = MaxDraughtCharges;
	OnDraughtsChanged.Broadcast(DraughtCharges, MaxDraughtCharges);
}

void AEnderPlayerCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!IsAlive()) return;

	// Thread regenerates 4/s up to MaxThread.
	const float Thread = AbilitySystem->GetNumericAttribute(UEnderAttributeSet::GetThreadAttribute());
	const float MaxThread = AbilitySystem->GetNumericAttribute(UEnderAttributeSet::GetMaxThreadAttribute());
	if (Thread < MaxThread)
	{
		AbilitySystem->SetNumericAttributeBase(UEnderAttributeSet::GetThreadAttribute(),
			FMath::Min(MaxThread, Thread + static_cast<float>(EnderRules::Thread::RegenPerSecond) * DeltaSeconds));
	}

	// Speed: attribute (slows) × ability phase multiplier; rooted or stunned → still.
	const bool bHeld = AbilitySystem->HasMatchingGameplayTag(EnderTags::State_Rooted) || AbilitySystem->HasMatchingGameplayTag(EnderTags::State_HitReact);
	GetCharacterMovement()->MaxWalkSpeed = bHeld ? 0.f : GetBaseMoveSpeed() * AbilityMoveMultiplier;

	// Face the aim point (independent of movement), unless an ability locked the facing.
	if (!AbilitySystem->HasMatchingGameplayTag(EnderTags::State_Attacking))
	{
		const FVector ToAim = (AimPoint - GetActorLocation()).GetSafeNormal2D();
		if (!ToAim.IsNearlyZero())
		{
			const FRotator Target = ToAim.Rotation();
			SetActorRotation(FMath::RInterpConstantTo(GetActorRotation(), Target, DeltaSeconds, TurnRateDegreesPerSecond));
		}
	}
}

void AEnderPlayerCharacter::HandleDamaged(const FEnderDamageEvent& Event)
{
	Super::HandleDamaged(Event);
	if (Event.HealthLost >= HeavyDamageThreshold) OnHeavyDamageTaken.Broadcast(Event.HealthLost);
	if (Event.bKilled) return;

	// §27: while Barrier holds, normal-enemy attacks cannot hit-stun.
	const bool bBarrier = AbilitySystem->HasMatchingGameplayTag(EnderTags::Effect_Barrier);
	if (bBarrier && Event.bInterruptsOnBarrier) return;
	if (Event.HealthLost <= 0.f && bBarrier) return;

	// Hit reaction outranks every input (§18): cancel what's running, briefly hold still.
	InputBuffer->ClearAll();
	AbilitySystem->CancelAllAbilities();
	UEnderCombatStatics::ApplyStatusTag(this, this, EnderTags::State_HitReact, HitStunDuration);
	if (HitReactMontage) PlayAnimMontage(HitReactMontage);

	// Platform-fighter feel: shared hitlag with the attacker, then a push away from it
	// that the move stick can bend (directional influence). Friction ends the slide.
	AEnderCharacterBase* Attacker = Cast<AEnderCharacterBase>(Event.Instigator);
	const float Hitlag = static_cast<float>(EnderRules::ControllerFeel::SharedHitlag(Event.Amount, EnderConvert::ToRules(Event.HitWeight)));
	if (Hitlag > 0.f)
	{
		PauseAnimation(Hitlag);
		if (Attacker) Attacker->PauseAnimation(Hitlag);
	}
	const FVector Away = Attacker ? (GetActorLocation() - Attacker->GetActorLocation()).GetSafeNormal2D() : FVector::ZeroVector;
	const double Speed = EnderRules::ControllerFeel::KnockbackSpeed(Event.HealthLost);
	if (!Away.IsNearlyZero() && Speed > 0)
	{
		const FVector Stick = GetMovementInput();
		const EnderRules::ControllerFeel::FVec2 Launch = EnderRules::ControllerFeel::ApplyDI({Away.X, Away.Y}, {Stick.X, Stick.Y});
		// Set velocity directly rather than LaunchCharacter, which would switch to Falling and hop.
		GetCharacterMovement()->Velocity = FVector(Launch.X, Launch.Y, 0.0) * Speed;
	}
}

void AEnderPlayerCharacter::HandleDeath(AActor* Killer)
{
	InputBuffer->ClearAll();
	// The Binder's corpse stays; the game mode handles the death screen and respawn.
	CorpseLifetime = 0.f;
	Super::HandleDeath(Killer);
}

void AEnderPlayerCharacter::OnDealtDamage(UEnderAbilitySystemComponent* Victim, const FEnderDamageEvent& Event)
{
	AEnderCharacterBase* VictimActor = Victim ? Cast<AEnderCharacterBase>(Victim->GetAvatarActor()) : nullptr;
	if (UEnderHitFeelSubsystem* Feel = GetWorld()->GetSubsystem<UEnderHitFeelSubsystem>())
	{
		const FVector Dir = VictimActor ? (VictimActor->GetActorLocation() - GetActorLocation()) : GetActorForwardVector();
		Feel->PlayHit(this, VictimActor, Event.Amount, Event.HitWeight, Event.bCrit, Event.bFirstUltimateImpact, Dir);
	}

	if (Event.bKilled && Victim)
	{
		// §33: 7% per normal kill; an elite always restores one if below max.
		const bool bElite = Victim->HasMatchingGameplayTag(EnderTags::Enemy_Elite);
		const bool bNormal = Victim->HasMatchingGameplayTag(EnderTags::Enemy_Normal);
		if ((bElite || bNormal) && DraughtCharges < MaxDraughtCharges)
		{
			if (UEnderRunRandomSubsystem* Rng = UEnderRunRandomSubsystem::Get(this))
			{
				if (EnderRules::Draught::RestoresCharge(bElite, DraughtCharges, Rng->Stream(EnderRules::Stream::Draught))) RestoreDraughtCharge();
			}
		}
	}
}

void AEnderPlayerCharacter::OnBarrierTagChanged(const FGameplayTag Tag, int32 NewCount)
{
	if (NewCount <= 0) AbilitySystem->SetNumericAttributeBase(UEnderAttributeSet::GetBarrierAttribute(), 0.f);
}
