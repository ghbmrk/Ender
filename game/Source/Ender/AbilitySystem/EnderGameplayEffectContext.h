#pragma once

#include "GameplayEffectTypes.h"
#include "Core/EnderTypes.h"
#include "EnderGameplayEffectContext.generated.h"

/**
 * Carries what the damage pipeline decided before the effect was applied:
 * the crit (rolled from the run's crit stream at hit time, §30), hit weight
 * (drives hit feel, §32) and whether a normal enemy dealt it (Barrier blocks
 * hit-stun from normal enemies only, §27).
 */
USTRUCT()
struct ENDER_API FEnderGameplayEffectContext : public FGameplayEffectContext
{
	GENERATED_BODY()

	UPROPERTY() bool bCrit = false;
	UPROPERTY() EEnderHitWeight HitWeight = EEnderHitWeight::Normal;
	UPROPERTY() bool bFirstUltimateImpact = false;
	UPROPERTY() bool bFromNormalEnemy = false;

	static const FEnderGameplayEffectContext* From(const FGameplayEffectContextHandle& Handle)
	{
		const FGameplayEffectContext* Base = Handle.Get();
		return (Base && Base->GetScriptStruct()->IsChildOf(StaticStruct())) ? static_cast<const FEnderGameplayEffectContext*>(Base) : nullptr;
	}
	static FEnderGameplayEffectContext* FromMutable(FGameplayEffectContextHandle& Handle)
	{
		FGameplayEffectContext* Base = Handle.Get();
		return (Base && Base->GetScriptStruct()->IsChildOf(StaticStruct())) ? static_cast<FEnderGameplayEffectContext*>(Base) : nullptr;
	}

	virtual UScriptStruct* GetScriptStruct() const override { return StaticStruct(); }
	virtual FEnderGameplayEffectContext* Duplicate() const override
	{
		FEnderGameplayEffectContext* New = new FEnderGameplayEffectContext(*this);
		if (GetHitResult()) New->AddHitResult(*GetHitResult(), true);
		return New;
	}
	virtual bool NetSerialize(FArchive& Ar, UPackageMap* Map, bool& bOutSuccess) override;
};

template <>
struct TStructOpsTypeTraits<FEnderGameplayEffectContext> : public TStructOpsTypeTraitsBase2<FEnderGameplayEffectContext>
{
	enum
	{
		WithNetSerializer = true,
		WithCopy = true,
	};
};
