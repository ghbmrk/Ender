#include "AbilitySystem/EnderDamageExecution.h"

#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayEffectContext.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Rules/BossRules.h"
#include "Rules/CombatRules.h"

namespace
{
	struct FCaptures
	{
		DECLARE_ATTRIBUTE_CAPTUREDEF(AttackPower);
		DECLARE_ATTRIBUTE_CAPTUREDEF(CritMultiplier);
		DECLARE_ATTRIBUTE_CAPTUREDEF(Armor);

		FCaptures()
		{
			DEFINE_ATTRIBUTE_CAPTUREDEF(UEnderAttributeSet, AttackPower, Source, true);
			DEFINE_ATTRIBUTE_CAPTUREDEF(UEnderAttributeSet, CritMultiplier, Source, true);
			DEFINE_ATTRIBUTE_CAPTUREDEF(UEnderAttributeSet, Armor, Target, false);
		}
	};

	const FCaptures& Captures()
	{
		static FCaptures C;
		return C;
	}
}

UEnderDamageExecution::UEnderDamageExecution()
{
	RelevantAttributesToCapture.Add(Captures().AttackPowerDef);
	RelevantAttributesToCapture.Add(Captures().CritMultiplierDef);
	RelevantAttributesToCapture.Add(Captures().ArmorDef);
}

void UEnderDamageExecution::Execute_Implementation(const FGameplayEffectCustomExecutionParameters& Params,
	FGameplayEffectCustomExecutionOutput& Out) const
{
	const FGameplayEffectSpec& Spec = Params.GetOwningSpec();
	const FGameplayTagContainer* TargetTags = Spec.CapturedTargetTags.GetAggregatedTags();
	if (TargetTags && (TargetTags->HasTagExact(EnderTags::State_Invulnerable) || TargetTags->HasTagExact(EnderTags::State_Dead))) return;

	FAggregatorEvaluateParameters Eval;
	Eval.SourceTags = Spec.CapturedSourceTags.GetAggregatedTags();
	Eval.TargetTags = TargetTags;

	float AttackPower = 1.f, CritMul = static_cast<float>(EnderRules::Damage::BaseCritMultiplier), Armor = 0.f;
	Params.AttemptCalculateCapturedAttributeMagnitude(Captures().AttackPowerDef, Eval, AttackPower);
	Params.AttemptCalculateCapturedAttributeMagnitude(Captures().CritMultiplierDef, Eval, CritMul);
	Params.AttemptCalculateCapturedAttributeMagnitude(Captures().ArmorDef, Eval, Armor);

	const float Base = Spec.GetSetByCallerMagnitude(EnderTags::Data_Damage, false, 0.f);
	const float Temporary = Spec.GetSetByCallerMagnitude(EnderTags::Data_TemporaryMultiplier, false, 1.f);
	const float Stagger = Spec.GetSetByCallerMagnitude(EnderTags::Data_Stagger, false, 0.f);

	const FEnderGameplayEffectContext* Ctx = FEnderGameplayEffectContext::From(Spec.GetContext());
	const bool bCrit = Ctx && Ctx->bCrit;
	const bool bStaggeredBoss = TargetTags && TargetTags->HasTagExact(EnderTags::Enemy_Boss) && TargetTags->HasTagExact(EnderTags::State_Staggered);

	double Amount = static_cast<double>(Base) * FMath::Max(0.f, AttackPower) * Temporary;
	if (bCrit) Amount *= CritMul;
	Amount *= EnderRules::Damage::ArmorMultiplier(Armor);
	if (bStaggeredBoss) Amount *= 1.0 + EnderRules::BoundKing::StaggeredDamageBonus;

	if (Amount > 0.0)
	{
		Out.AddOutputModifier(FGameplayModifierEvaluatedData(UEnderAttributeSet::GetIncomingDamageAttribute(), EGameplayModOp::Additive, static_cast<float>(Amount)));
	}
	if (Stagger > 0.f)
	{
		Out.AddOutputModifier(FGameplayModifierEvaluatedData(UEnderAttributeSet::GetIncomingStaggerAttribute(), EGameplayModOp::Additive, Stagger));
	}
}
