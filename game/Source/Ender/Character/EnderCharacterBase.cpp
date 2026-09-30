#include "Character/EnderCharacterBase.h"

#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Combat/EnderCombatStatics.h"
#include "Combat/EnderTargetSweepComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "TimerManager.h"

AEnderCharacterBase::AEnderCharacterBase(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	PrimaryActorTick.bCanEverTick = true;
	AbilitySystem = CreateDefaultSubobject<UEnderAbilitySystemComponent>(TEXT("AbilitySystem"));
	AbilitySystem->SetReplicationMode(EGameplayEffectReplicationMode::Minimal);
	Attributes = CreateDefaultSubobject<UEnderAttributeSet>(TEXT("Attributes"));
	TargetSweep = CreateDefaultSubobject<UEnderTargetSweepComponent>(TEXT("TargetSweep"));

	// Top-down: the character faces where it is told to (aim), never the camera.
	bUseControllerRotationYaw = false;
	GetCharacterMovement()->bOrientRotationToMovement = false;
	GetCharacterMovement()->bConstrainToPlane = true;
	GetCharacterMovement()->bSnapToPlaneAtStart = true;
	GetCharacterMovement()->SetPlaneConstraintNormal(FVector::UpVector);
}

UAbilitySystemComponent* AEnderCharacterBase::GetAbilitySystemComponent() const
{
	return AbilitySystem;
}

bool AEnderCharacterBase::IsAlive() const
{
	return UEnderCombatStatics::IsAlive(this);
}

void AEnderCharacterBase::BeginPlay()
{
	Super::BeginPlay();
	AbilitySystem->InitAbilityActorInfo(this, this);
	AbilitySystem->OnDamagedNative.AddUObject(this, &AEnderCharacterBase::OnDamagedNative);
	AbilitySystem->OnDied.AddDynamic(this, &AEnderCharacterBase::OnDiedDynamic);
	GrantStartupAbilities();
	SetOutlineStencil(OutlineStencil);
}

void AEnderCharacterBase::PossessedBy(AController* NewController)
{
	Super::PossessedBy(NewController);
	AbilitySystem->InitAbilityActorInfo(this, this);
	GrantStartupAbilities();
}

void AEnderCharacterBase::GrantStartupAbilities()
{
	if (bAbilitiesGranted || !AbilitySystem->AbilityActorInfo.IsValid()) return;
	bAbilitiesGranted = true;
	for (const TSubclassOf<UGameplayAbility>& Ability : StartupAbilities)
	{
		if (Ability) AbilitySystem->GiveAbility(FGameplayAbilitySpec(Ability, 1, INDEX_NONE, this));
	}
}

void AEnderCharacterBase::SetOutlineStencil(int32 Stencil)
{
	OutlineStencil = Stencil;
	const bool bEnable = Stencil > 0;
	TArray<UPrimitiveComponent*> Prims;
	GetComponents<UPrimitiveComponent>(Prims);
	for (UPrimitiveComponent* P : Prims)
	{
		if (P == GetCapsuleComponent()) continue;
		P->SetRenderCustomDepth(bEnable);
		P->SetCustomDepthStencilValue(Stencil);
	}
}

void AEnderCharacterBase::PlayHitFlash(float Duration)
{
	if (FlashMaterials.Num() == 0 && GetMesh())
	{
		for (int32 I = 0; I < GetMesh()->GetNumMaterials(); ++I)
		{
			if (UMaterialInstanceDynamic* MID = GetMesh()->CreateAndSetMaterialInstanceDynamic(I)) FlashMaterials.Add(MID);
		}
	}
	FlashLeft = FMath::Max(FlashLeft, Duration);
	for (UMaterialInstanceDynamic* MID : FlashMaterials) MID->SetScalarParameterValue(TEXT("HitFlash"), 1.f);
}

void AEnderCharacterBase::PauseAnimation(float Duration)
{
	PauseLeft = FMath::Max(PauseLeft, Duration);
	if (GetMesh()) GetMesh()->bPauseAnims = true;
}

void AEnderCharacterBase::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	// Flash and pause count real time so a global hitstop cannot stretch them.
	const float RealDt = FApp::GetDeltaTime();
	if (FlashLeft > 0.f)
	{
		FlashLeft -= RealDt;
		if (FlashLeft <= 0.f)
			for (UMaterialInstanceDynamic* MID : FlashMaterials) MID->SetScalarParameterValue(TEXT("HitFlash"), 0.f);
	}
	if (PauseLeft > 0.f)
	{
		PauseLeft -= RealDt;
		if (PauseLeft <= 0.f && GetMesh()) GetMesh()->bPauseAnims = false;
	}
}

void AEnderCharacterBase::OnDamagedNative(UEnderAbilitySystemComponent* /*Victim*/, const FEnderDamageEvent& Event)
{
	HandleDamaged(Event);
}

void AEnderCharacterBase::HandleDamaged(const FEnderDamageEvent& Event)
{
	OnDamagedCue(Event);
}

void AEnderCharacterBase::OnDiedDynamic(AActor* Killer)
{
	HandleDeath(Killer);
}

void AEnderCharacterBase::HandleDeath(AActor* Killer)
{
	GetCharacterMovement()->DisableMovement();
	GetCharacterMovement()->StopMovementImmediately();
	GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	SetOutlineStencil(0);
	OnDeathStarted(Killer);

	float Length = DeathDuration;
	if (DeathMontage)
	{
		PlayAnimMontage(DeathMontage);
		Length = FMath::Clamp(DeathMontage->GetPlayLength(), 0.75f, 1.25f);
	}
	FTimerDelegate Breakup = FTimerDelegate::CreateWeakLambda(this, [this]() { OnPigmentBreakup(); });
	GetWorldTimerManager().SetTimer(BreakupTimer, Breakup, Length, false);
	SetLifeSpan(CorpseLifetime);
}
