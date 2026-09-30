#include "Combat/EnderCombatStatics.h"

#include "AbilitySystemBlueprintLibrary.h"
#include "AbilitySystemComponent.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayEffectContext.h"
#include "AbilitySystem/EnderGameplayEffects.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Combat/EnderRunRandomSubsystem.h"

UAbilitySystemComponent* UEnderCombatStatics::ASCOf(const AActor* Actor)
{
	return UAbilitySystemBlueprintLibrary::GetAbilitySystemComponent(const_cast<AActor*>(Actor));
}

bool UEnderCombatStatics::IsAlive(const AActor* Actor)
{
	const UAbilitySystemComponent* ASC = ASCOf(Actor);
	return ASC && !ASC->HasMatchingGameplayTag(EnderTags::State_Dead) &&
		ASC->GetNumericAttribute(UEnderAttributeSet::GetHealthAttribute()) > 0.f;
}

bool UEnderCombatStatics::HasTag(const AActor* Actor, FGameplayTag Tag)
{
	const UAbilitySystemComponent* ASC = ASCOf(Actor);
	return ASC && ASC->HasMatchingGameplayTag(Tag);
}

bool UEnderCombatStatics::ApplyDamage(AActor* Source, AActor* Target, const FEnderDamageParams& Params, const FHitResult& Hit)
{
	UAbilitySystemComponent* SourceASC = ASCOf(Source);
	UAbilitySystemComponent* TargetASC = ASCOf(Target);
	if (!SourceASC || !TargetASC || !IsAlive(Target)) return false;
	if (TargetASC->HasMatchingGameplayTag(EnderTags::State_Invulnerable)) return false;

	FGameplayEffectContextHandle Context = SourceASC->MakeEffectContext();
	Context.AddSourceObject(Source);
	Context.AddHitResult(Hit, true);
	if (FEnderGameplayEffectContext* Ender = FEnderGameplayEffectContext::FromMutable(Context))
	{
		bool bCrit = false;
		if (Params.bCanCrit)
		{
			const float CritChance = SourceASC->GetNumericAttribute(UEnderAttributeSet::GetCritChanceAttribute());
			if (UEnderRunRandomSubsystem* Rng = UEnderRunRandomSubsystem::Get(Source))
				bCrit = Rng->Stream(EnderRules::Stream::Crit).Chance(CritChance);
		}
		Ender->bCrit = bCrit;
		Ender->HitWeight = Params.HitWeight;
		Ender->bFirstUltimateImpact = Params.bFirstUltimateImpact;
		Ender->bFromNormalEnemy = SourceASC->HasMatchingGameplayTag(EnderTags::Enemy_Normal);
	}

	FGameplayEffectSpecHandle Spec = SourceASC->MakeOutgoingSpec(UEnderGE_Damage::StaticClass(), 1.f, Context);
	if (!Spec.IsValid()) return false;
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Damage, Params.BaseDamage);
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Stagger, Params.Stagger);
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_TemporaryMultiplier, Params.TemporaryMultiplier);
	if (Params.DamageType.IsValid()) Spec.Data->AddDynamicAssetTag(Params.DamageType);
	SourceASC->ApplyGameplayEffectSpecToTarget(*Spec.Data, TargetASC);
	return true;
}

void UEnderCombatStatics::ApplyStatusTag(AActor* Source, AActor* Target, FGameplayTag Tag, float Duration)
{
	UAbilitySystemComponent* SourceASC = ASCOf(Source ? Source : Target);
	UAbilitySystemComponent* TargetASC = ASCOf(Target);
	if (!SourceASC || !TargetASC || Duration <= 0.f) return;
	FGameplayEffectSpecHandle Spec = SourceASC->MakeOutgoingSpec(UEnderGE_Status::StaticClass(), 1.f, SourceASC->MakeEffectContext());
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Duration, Duration);
	Spec.Data->DynamicGrantedTags.AddTag(Tag);
	SourceASC->ApplyGameplayEffectSpecToTarget(*Spec.Data, TargetASC);
}

void UEnderCombatStatics::ApplyMoveSpeedScale(AActor* Source, AActor* Target, float Scale, float Duration)
{
	UAbilitySystemComponent* SourceASC = ASCOf(Source ? Source : Target);
	UAbilitySystemComponent* TargetASC = ASCOf(Target);
	if (!SourceASC || !TargetASC || Duration <= 0.f) return;
	FGameplayEffectSpecHandle Spec = SourceASC->MakeOutgoingSpec(UEnderGE_MoveSpeedScale::StaticClass(), 1.f, SourceASC->MakeEffectContext());
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Duration, Duration);
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Magnitude, Scale);
	Spec.Data->DynamicGrantedTags.AddTag(EnderTags::Effect_Slow);
	SourceASC->ApplyGameplayEffectSpecToTarget(*Spec.Data, TargetASC);
}

void UEnderCombatStatics::AddThread(AActor* Target, float Delta)
{
	UAbilitySystemComponent* ASC = ASCOf(Target);
	if (!ASC || Delta == 0.f) return;
	FGameplayEffectSpecHandle Spec = ASC->MakeOutgoingSpec(UEnderGE_ThreadDelta::StaticClass(), 1.f, ASC->MakeEffectContext());
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Magnitude, Delta);
	ASC->ApplyGameplayEffectSpecToSelf(*Spec.Data);
}
