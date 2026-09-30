#pragma once

#include "GameplayEffect.h"
#include "EnderGameplayEffects.generated.h"

/*
 * Code-defined effects. The spec puts per-ability tuning in Data Assets; these
 * are the generic carriers those values flow through as SetByCaller magnitudes.
 */

/** Instant; runs UEnderDamageExecution. SetByCaller: Data.Damage, Data.Stagger, Data.TemporaryMultiplier. */
UCLASS()
class ENDER_API UEnderGE_Damage : public UGameplayEffect
{
	GENERATED_BODY()
public:
	UEnderGE_Damage();
};

/** Duration = Data.Duration. The cooldown tag is added to the spec's granted tags at application. */
UCLASS()
class ENDER_API UEnderGE_Cooldown : public UGameplayEffect
{
	GENERATED_BODY()
public:
	UEnderGE_Cooldown();
};

/** Instant Thread add/subtract. Data.Magnitude (negative spends). Used as ability Cost and on Lash hits. */
UCLASS()
class ENDER_API UEnderGE_ThreadDelta : public UGameplayEffect
{
	GENERATED_BODY()
public:
	UEnderGE_ThreadDelta();
};

/** Instant Barrier override to Data.Magnitude (Warding Sigil sets it, expiry clears it). */
UCLASS()
class ENDER_API UEnderGE_SetBarrier : public UGameplayEffect
{
	GENERATED_BODY()
public:
	UEnderGE_SetBarrier();
};

/** Duration = Data.Duration; grants whatever status tag the applier adds (Effect.Root, Effect.Slow, Effect.Barrier, State.Invulnerable…). */
UCLASS()
class ENDER_API UEnderGE_Status : public UGameplayEffect
{
	GENERATED_BODY()
public:
	UEnderGE_Status();
};

/** Duration = Data.Duration; multiplies MoveSpeed by Data.Magnitude (e.g. 0.65 for a 35% slow). */
UCLASS()
class ENDER_API UEnderGE_MoveSpeedScale : public UGameplayEffect
{
	GENERATED_BODY()
public:
	UEnderGE_MoveSpeedScale();
};

/** Instant heal by Data.Magnitude (Draught). */
UCLASS()
class ENDER_API UEnderGE_Heal : public UGameplayEffect
{
	GENERATED_BODY()
public:
	UEnderGE_Heal();
};
