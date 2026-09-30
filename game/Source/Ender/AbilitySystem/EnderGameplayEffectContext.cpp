#include "AbilitySystem/EnderGameplayEffectContext.h"

bool FEnderGameplayEffectContext::NetSerialize(FArchive& Ar, UPackageMap* Map, bool& bOutSuccess)
{
	Super::NetSerialize(Ar, Map, bOutSuccess);
	uint8 Weight = static_cast<uint8>(HitWeight);
	Ar.SerializeBits(&bCrit, 1);
	Ar.SerializeBits(&bFirstUltimateImpact, 1);
	Ar.SerializeBits(&bFromNormalEnemy, 1);
	Ar << Weight;
	HitWeight = static_cast<EEnderHitWeight>(Weight);
	return true;
}
