#include "AbilitySystem/Abilities/EnderAbility_SequencedStrikes.h"

#include "AbilitySystem/EnderAbilityDefinition.h"
#include "Character/EnderPlayerCharacter.h"
#include "Combat/EnderTargetSweepComponent.h"

void UEnderAbility_SequencedStrikes::OnActivated()
{
	Origin = GetAvatarActorFromActorInfo()->GetActorLocation();
	Direction = GetAimDirection();
	NextStrike = 0;
	bLandedFirst = false;
	if (AEnderPlayerCharacter* Binder = GetBinder()) Binder->FaceDirection(Direction);
}

void UEnderAbility_SequencedStrikes::OnAttackWindowTick(float SecondsIntoWindow, float)
{
	while (NextStrike < Definition->StrikeDistances.Num() && SecondsIntoWindow + KINDA_SMALL_NUMBER >= Definition->StrikeDelay * NextStrike)
	{
		Strike(NextStrike++);
	}
}

void UEnderAbility_SequencedStrikes::OnAttackWindowEnd(bool bCompleted)
{
	// A slow frame can end the window before the last strike's time is ticked.
	while (bCompleted && NextStrike < Definition->StrikeDistances.Num()) Strike(NextStrike++);
}

void UEnderAbility_SequencedStrikes::Strike(int32 Index)
{
	UEnderTargetSweepComponent* Sweep = GetSweep();
	if (!Sweep) return;
	const FVector Center = Origin + Direction * Definition->StrikeDistances[Index];
	Sweep->BeginExecution(); // fresh hit set per strike: the same enemy may be hit by all three
	for (const FHitResult& Hit : Sweep->RadialQuery(Center, Definition->Radius))
	{
		if (DealDamage(Hit.GetActor(), Hit, Definition->Damage, Definition->Stagger, !bLandedFirst)) bLandedFirst = true;
	}
	OnStrike(Index, Center, Definition->Radius);
}
