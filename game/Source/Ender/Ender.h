#pragma once

#include "CoreMinimal.h"

DECLARE_LOG_CATEGORY_EXTERN(LogEnder, Log, All);

/** Custom collision channels (Config/DefaultEngine.ini). */
#define ENDER_TRACE_COMBAT ECC_GameTraceChannel1
#define ENDER_OBJECT_ENEMY_PROJECTILE ECC_GameTraceChannel2
#define ENDER_OBJECT_ENEMY ECC_GameTraceChannel3

/** Custom Stencil values used by the outline post-process (docs/ART_SPEC.md). */
namespace EnderStencil
{
	constexpr int32 Player = 1;
	constexpr int32 Enemy = 2;
	constexpr int32 Elite = 3;
	constexpr int32 Boss = 4;
	constexpr int32 Interactable = 5;
	constexpr int32 ValuableLoot = 6;
}
