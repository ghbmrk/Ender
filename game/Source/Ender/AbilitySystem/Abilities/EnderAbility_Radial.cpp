#include "AbilitySystem/Abilities/EnderAbility_Radial.h"

#include "AbilitySystem/EnderAbilityDefinition.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Combat/EnderCombatStatics.h"
#include "Combat/EnderTargetSweepComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/RootMotionSource.h"

void UEnderAbility_Radial::OnAttackWindowTick(float, float)
{
	UEnderTargetSweepComponent* Sweep = GetSweep();
	AActor* Avatar = GetAvatarActorFromActorInfo();
	if (!Sweep || !Avatar) return;

	for (const FHitResult& Hit : Sweep->RadialQuery(Avatar->GetActorLocation(), Definition->Radius))
	{
		AActor* Target = Hit.GetActor();
		if (UEnderCombatStatics::HasTag(Target, EnderTags::Enemy_Boss))
		{
			DealDamage(Target, Hit, Definition->Damage, Definition->BossStagger);
		}
		else if (UEnderCombatStatics::HasTag(Target, EnderTags::Enemy_Elite))
		{
			if (!DealDamage(Target, Hit, Definition->Damage, Definition->EliteStagger)) continue;
			Pull(Target, Definition->ElitePull);
			UEnderCombatStatics::ApplyMoveSpeedScale(Avatar, Target, 1.f - Definition->EliteSlow, Definition->EliteDuration);
		}
		else
		{
			if (!DealDamage(Target, Hit, Definition->Damage, 0.f)) continue;
			Pull(Target, Definition->NormalPull);
			UEnderCombatStatics::ApplyStatusTag(Avatar, Target, EnderTags::Effect_Root, Definition->NormalRoot);
			UEnderCombatStatics::ApplyStatusTag(Avatar, Target, EnderTags::State_Rooted, Definition->NormalRoot);
		}
	}
}

void UEnderAbility_Radial::Pull(AActor* Target, float Distance) const
{
	ACharacter* Victim = Cast<ACharacter>(Target);
	const AActor* Avatar = GetAvatarActorFromActorInfo();
	if (!Victim || !Avatar || Distance <= 0.f || !UEnderCombatStatics::IsAlive(Victim)) return;

	const FVector From = Victim->GetActorLocation();
	const FVector ToBinder = (Avatar->GetActorLocation() - From) * FVector(1, 1, 0);
	const float Available = FMath::Max(0.f, ToBinder.Size() - PullStandoff);
	const float Move = FMath::Min(Distance, Available);
	if (Move < 1.f) return;

	TSharedPtr<FRootMotionSource_MoveToForce> Source = MakeShared<FRootMotionSource_MoveToForce>();
	Source->InstanceName = TEXT("BindPull");
	Source->AccumulateMode = ERootMotionAccumulateMode::Override;
	Source->Priority = 500;
	Source->StartLocation = From;
	Source->TargetLocation = From + ToBinder.GetSafeNormal() * Move;
	Source->Duration = PullDuration;
	Source->bRestrictSpeedToExpected = true;
	Source->FinishVelocityParams.Mode = ERootMotionFinishVelocityMode::SetVelocity;
	Source->FinishVelocityParams.SetVelocity = FVector::ZeroVector;
	Victim->GetCharacterMovement()->ApplyRootMotionSource(Source);
}
