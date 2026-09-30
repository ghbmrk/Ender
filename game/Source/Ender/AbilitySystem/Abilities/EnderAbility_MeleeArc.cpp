#include "AbilitySystem/Abilities/EnderAbility_MeleeArc.h"

#include "Abilities/Tasks/AbilityTask_ApplyRootMotionConstantForce.h"
#include "AbilitySystem/EnderAbilityDefinition.h"
#include "Character/EnderPlayerCharacter.h"
#include "Combat/EnderCombatStatics.h"
#include "Combat/EnderTargetSweepComponent.h"
#include "MotionWarpingComponent.h"

void UEnderAbility_MeleeArc::OnActivated()
{
	StrikeDirection = GetAimDirection();
	bGainedThread = false;
	if (AEnderPlayerCharacter* Binder = GetBinder())
	{
		Binder->FaceDirection(StrikeDirection);
		// Any other ability since the last Lash breaks the chain.
		if (Definition->ComboWindow > 0.f && Binder->ConsumeLashChainBreak()) Combo.Break();
	}
	bEmpowered = Definition->ComboWindow > 0.f && Combo.OnLash(GetWorld()->GetTimeSeconds());

	if (Definition->Distance > 0.f)
	{
		// Sever: the lunge goes toward the aim point, never past it.
		AActor* Avatar = GetAvatarActorFromActorInfo();
		const float ToAim = FVector::Dist2D(GetAimPoint(), Avatar->GetActorLocation());
		const float Lunge = FMath::Min(Definition->Distance, FMath::Max(0.f, ToAim - 60.f));
		if (UMotionWarpingComponent* Warp = Avatar->FindComponentByClass<UMotionWarpingComponent>())
		{
			Warp->AddOrUpdateWarpTargetFromLocationAndRotation(WarpTargetName, Avatar->GetActorLocation() + StrikeDirection * Lunge, StrikeDirection.Rotation());
		}
	}
}

UAnimMontage* UEnderAbility_MeleeArc::ChooseMontage() const
{
	if (bEmpowered && Definition->ComboMontage) return Definition->ComboMontage;
	return Super::ChooseMontage();
}

void UEnderAbility_MeleeArc::OnAttackWindowBegin()
{
	// Placeholder montages carry no root motion: drive the Sever lunge over the active window instead.
	if (Definition->Distance > 0.f && Definition->Active > 0.f && (!Definition->Montage || !Definition->Montage->HasRootMotion()))
	{
		const AActor* Avatar = GetAvatarActorFromActorInfo();
		const float ToAim = FVector::Dist2D(GetAimPoint(), Avatar->GetActorLocation());
		const float Lunge = FMath::Min(Definition->Distance, FMath::Max(0.f, ToAim - 60.f));
		if (Lunge > 1.f)
		{
			UAbilityTask_ApplyRootMotionConstantForce* Force = UAbilityTask_ApplyRootMotionConstantForce::ApplyRootMotionConstantForce(
				this, TEXT("SeverLunge"), StrikeDirection, Lunge / Definition->Active, Definition->Active, false, nullptr,
				ERootMotionFinishVelocityMode::SetVelocity, FVector::ZeroVector, 0.f, false);
			Force->ReadyForActivation();
		}
	}
}

void UEnderAbility_MeleeArc::OnAttackWindowTick(float SecondsIntoWindow, float DeltaTime)
{
	UEnderTargetSweepComponent* Sweep = GetSweep();
	const AActor* Avatar = GetAvatarActorFromActorInfo();
	if (!Sweep || !Avatar) return;

	const float Damage = bEmpowered ? Definition->ComboDamage : Definition->Damage;
	const float Stagger = bEmpowered ? Definition->ComboStagger : Definition->Stagger;
	for (const FHitResult& Hit : Sweep->ConeQuery(Avatar->GetActorLocation(), StrikeDirection, Definition->Range, Definition->ArcDegrees))
	{
		if (DealDamage(Hit.GetActor(), Hit, Damage, Stagger) && !bGainedThread)
		{
			// Basic attack generates Thread once per swing that connects.
			const float Gain = bEmpowered ? Definition->ComboThreadGain : Definition->ThreadGain;
			if (Gain > 0.f) UEnderCombatStatics::AddThread(GetAvatarActorFromActorInfo(), Gain);
			bGainedThread = true;
		}
	}
}
