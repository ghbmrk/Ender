#include "AbilitySystem/Abilities/EnderAbility_ExpandingRing.h"

#include "AbilitySystem/EnderAbilityDefinition.h"
#include "AbilitySystemComponent.h"
#include "Combat/EnderTargetSweepComponent.h"
#include "GameplayCueManager.h"

float UEnderAbility_ExpandingRing::RadiusAt(float SecondsIntoWindow) const
{
	if (!Definition || Definition->Active <= 0.f) return Definition ? Definition->Radius : 0.f;
	const float A = FMath::Clamp(SecondsIntoWindow / Definition->Active, 0.f, 1.f);
	return FMath::Lerp(Definition->StartRadius, Definition->Radius, A);
}

void UEnderAbility_ExpandingRing::OnAttackWindowBegin()
{
	Center = GetAvatarActorFromActorInfo()->GetActorLocation();
	if (Definition->CueTag.IsValid())
	{
		// One-shot "expansion started" cue: RawMagnitude = end radius, NormalizedMagnitude = duration.
		FGameplayCueParameters Cue;
		Cue.Location = Center;
		Cue.RawMagnitude = Definition->Radius;
		Cue.NormalizedMagnitude = Definition->Active;
		GetAbilitySystemComponentFromActorInfo()->ExecuteGameplayCue(Definition->CueTag, Cue);
	}
}

void UEnderAbility_ExpandingRing::OnAttackWindowTick(float SecondsIntoWindow, float)
{
	UEnderTargetSweepComponent* Sweep = GetSweep();
	if (!Sweep) return;
	for (const FHitResult& Hit : Sweep->RadialQuery(Center, RadiusAt(SecondsIntoWindow)))
		DealDamage(Hit.GetActor(), Hit, Definition->Damage, Definition->Stagger);
}

void UEnderAbility_ExpandingRing::OnAttackWindowEnd(bool bCompleted)
{
	UEnderTargetSweepComponent* Sweep = GetSweep();
	if (!Sweep || !bCompleted) return;
	for (const FHitResult& Hit : Sweep->RadialQuery(Center, Definition->Radius))
		DealDamage(Hit.GetActor(), Hit, Definition->Damage, Definition->Stagger);
}
