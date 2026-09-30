#pragma once

#include "GameplayEffectExecutionCalculation.h"
#include "EnderDamageExecution.generated.h"

/**
 * §30 damage model:
 *   raw     = base (SetByCaller Data.Damage) × source AttackPower (gear) × Data.TemporaryMultiplier
 *   crit    = decided before application from the run's crit stream (context bCrit) → × CritMultiplier
 *   mitig.  = 100 / (100 + target Armor)
 *   bonus   = +25% on a staggered boss (§51)
 * Invulnerable targets take nothing. Output goes to the IncomingDamage / IncomingStagger meta attributes.
 */
UCLASS()
class ENDER_API UEnderDamageExecution : public UGameplayEffectExecutionCalculation
{
	GENERATED_BODY()

public:
	UEnderDamageExecution();
	virtual void Execute_Implementation(const FGameplayEffectCustomExecutionParameters& Params,
		FGameplayEffectCustomExecutionOutput& Out) const override;
};
