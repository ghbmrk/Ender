#include "AbilitySystem/Abilities/EnderAbility_Evade.h"

#include "Abilities/Tasks/AbilityTask_ApplyRootMotionConstantForce.h"
#include "AbilitySystem/EnderAbilityDefinition.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "AbilitySystem/Notifies/ANS_AttackWindow.h"
#include "Animation/AnimMontage.h"
#include "Character/EnderPlayerCharacter.h"
#include "Curves/CurveFloat.h"
#include "Rules/CombatRules.h"

UEnderAbility_Evade::UEnderAbility_Evade()
{
	ActivationOwnedTags.AddTag(EnderTags::State_Evading);
}

void UEnderAbility_Evade::OnActivated()
{
	AEnderPlayerCharacter* Binder = GetBinder();
	if (!Binder) return;

	if (!SpeedCurve)
	{
		SpeedCurve = NewObject<UCurveFloat>(this);
		constexpr int32 Samples = 24;
		for (int32 I = 0; I <= Samples; ++I)
		{
			const float A = static_cast<float>(I) / Samples;
			SpeedCurve->FloatCurve.AddKey(A, static_cast<float>(EnderRules::Evade::SpeedFraction(A)));
		}
	}

	const FVector Input = Binder->GetMovementInput();
	const FVector Facing = Binder->GetActorForwardVector();
	double DX, DY;
	EnderRules::Evade::ChooseDirection(Input.X, Input.Y, Facing.X, Facing.Y, DX, DY);
	const FVector Dir(DX, DY, 0.0);

	// Peak speed so that the curve integrates to exactly Distance over Active.
	const double Duration = Definition->Active;
	const double Peak = Definition->Distance / (Duration * EnderRules::Evade::RawDistance(1.0));
	UAbilityTask_ApplyRootMotionConstantForce* Force = UAbilityTask_ApplyRootMotionConstantForce::ApplyRootMotionConstantForce(
		this, TEXT("Evade"), Dir, static_cast<float>(Peak), static_cast<float>(Duration), false, SpeedCurve,
		ERootMotionFinishVelocityMode::ClampVelocity, FVector::ZeroVector, Binder->GetBaseMoveSpeed() * 0.5f, false);
	Force->ReadyForActivation();

	bMontageInvuln = false;
	if (const UAnimMontage* Montage = Definition->Montage)
		for (const FAnimNotifyEvent& N : Montage->Notifies)
			bMontageInvuln |= Cast<UANS_Invulnerability>(N.NotifyStateClass) != nullptr;
}

void UEnderAbility_Evade::OnAttackWindowTick(float SecondsIntoWindow, float)
{
	if (bMontageInvuln) return;
	// Evade's window starts at 0 (no windup), so window time is ability time.
	SetOwnedLooseTag(EnderTags::State_Invulnerable,
		SecondsIntoWindow >= Definition->InvulnStart && SecondsIntoWindow < Definition->InvulnEnd);
}
