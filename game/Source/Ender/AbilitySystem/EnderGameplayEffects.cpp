#include "AbilitySystem/EnderGameplayEffects.h"

#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderDamageExecution.h"
#include "AbilitySystem/EnderGameplayTags.h"

namespace
{
	FGameplayEffectModifierMagnitude SetByCaller(const FGameplayTag& Tag)
	{
		FSetByCallerFloat SBC;
		SBC.DataTag = Tag;
		return FGameplayEffectModifierMagnitude(SBC);
	}

	FGameplayModifierInfo Modifier(const FGameplayAttribute& Attr, EGameplayModOp::Type Op, const FGameplayTag& Tag)
	{
		FGameplayModifierInfo M;
		M.Attribute = Attr;
		M.ModifierOp = Op;
		M.ModifierMagnitude = SetByCaller(Tag);
		return M;
	}
}

UEnderGE_Damage::UEnderGE_Damage()
{
	DurationPolicy = EGameplayEffectDurationType::Instant;
	FGameplayEffectExecutionDefinition Exec;
	Exec.CalculationClass = UEnderDamageExecution::StaticClass();
	Executions.Add(Exec);
}

UEnderGE_Cooldown::UEnderGE_Cooldown()
{
	DurationPolicy = EGameplayEffectDurationType::HasDuration;
	DurationMagnitude = SetByCaller(EnderTags::Data_Duration);
}

UEnderGE_ThreadDelta::UEnderGE_ThreadDelta()
{
	DurationPolicy = EGameplayEffectDurationType::Instant;
	Modifiers.Add(Modifier(UEnderAttributeSet::GetThreadAttribute(), EGameplayModOp::Additive, EnderTags::Data_Magnitude));
}

UEnderGE_SetBarrier::UEnderGE_SetBarrier()
{
	DurationPolicy = EGameplayEffectDurationType::Instant;
	Modifiers.Add(Modifier(UEnderAttributeSet::GetBarrierAttribute(), EGameplayModOp::Override, EnderTags::Data_Magnitude));
}

UEnderGE_Status::UEnderGE_Status()
{
	DurationPolicy = EGameplayEffectDurationType::HasDuration;
	DurationMagnitude = SetByCaller(EnderTags::Data_Duration);
}

UEnderGE_MoveSpeedScale::UEnderGE_MoveSpeedScale()
{
	DurationPolicy = EGameplayEffectDurationType::HasDuration;
	DurationMagnitude = SetByCaller(EnderTags::Data_Duration);
	Modifiers.Add(Modifier(UEnderAttributeSet::GetMoveSpeedAttribute(), EGameplayModOp::Multiplicitive, EnderTags::Data_Magnitude));
}

UEnderGE_Heal::UEnderGE_Heal()
{
	DurationPolicy = EGameplayEffectDurationType::Instant;
	Modifiers.Add(Modifier(UEnderAttributeSet::GetHealthAttribute(), EGameplayModOp::Additive, EnderTags::Data_Magnitude));
}
