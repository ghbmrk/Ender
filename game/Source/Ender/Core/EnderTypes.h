#pragma once

#include "CoreMinimal.h"
#include "Rules/EncounterRules.h"
#include "Rules/LootRules.h"
#include "EnderTypes.generated.h"

/*
 * Reflected mirrors of the engine-free rule enums (Rules/*.h). Values match
 * one-to-one so ToRules()/FromRules() are plain casts; static_asserts below
 * keep them in step.
 */

UENUM(BlueprintType)
enum class EEnderArchetype : uint8
{
	Husk,
	Hound,
	Wisp,
	Keeper,
	Seer,
	BoundKing UMETA(DisplayName = "The Bound King"),
};

UENUM(BlueprintType)
enum class EEnderEliteModifier : uint8
{
	None,
	Hardened,
	Volatile,
};

UENUM(BlueprintType)
enum class EEnderTokenPool : uint8
{
	Melee,
	Ranged,
	Heavy,
};

UENUM(BlueprintType)
enum class EEnderTelegraphClass : uint8
{
	MinorMelee,
	FastLeap,
	Projectile,
	Heavy,
	DangerZone,
	BossMajor,
	BossLethal,
};

UENUM(BlueprintType)
enum class EEnderQuality : uint8
{
	Burden,
	Veil,
	Reach,
	Knots,
	Flex,
	Bond,
};

UENUM(BlueprintType)
enum class EEnderEssence : uint8
{
	Ember,
	Tide,
	Storm,
	Root,
	Glass,
	Ash,
};

UENUM(BlueprintType)
enum class EEnderRoomKind : uint8
{
	Room1,
	Room2,
	Room3,
	Room4,
	Elite,
};

UENUM(BlueprintType)
enum class EEnderDropSource : uint8
{
	Room1,
	Room2,
	Room3,
	Room4,
	Elite,
	Boss,
};

UENUM(BlueprintType)
enum class EEnderEvidenceTier : uint8
{
	Veiled,
	Attuned,
	Trialed,
	Witnessed,
};

UENUM(BlueprintType)
enum class EEnderGearSlot : uint8
{
	Blade,
	Ward,
	Sigil,
	Charm,
};

UENUM(BlueprintType)
enum class EEnderFamiliarAction : uint8
{
	Attune,
	Fracture,
	Temper,
	Mirror,
	DeepTrial,
	Trial,
};

UENUM(BlueprintType)
enum class EEnderHitWeight : uint8
{
	Normal,
	Heavy,
	Ultimate,
};

/** Priority classes of the combat input buffer (§18). */
UENUM(BlueprintType)
enum class EEnderInputPriority : uint8
{
	Movement,
	Basic,
	Skill,
	Defensive,
	Evade,
	HitReaction,
	Death,
};

/** Realm segments in the fixed sequence (§49). */
UENUM(BlueprintType)
enum class EEnderRealmSegment : uint8
{
	Entry,
	Room1,
	Connector,
	Room2,
	AttunementShrine,
	Room3,
	Room4,
	Elite,
	RecoverySpace,
	Boss,
	RewardAltar,
	ReturnPortal,
};

static_assert(static_cast<int>(EEnderArchetype::Seer) == static_cast<int>(EnderRules::EArchetype::Seer));
static_assert(static_cast<int>(EEnderEliteModifier::Volatile) == static_cast<int>(EnderRules::EEliteModifier::Volatile));
static_assert(static_cast<int>(EEnderTokenPool::Heavy) == static_cast<int>(EnderRules::ETokenPool::Heavy));
static_assert(static_cast<int>(EEnderTelegraphClass::BossLethal) == static_cast<int>(EnderRules::ETelegraphClass::BossLethal));
static_assert(static_cast<int>(EEnderQuality::Bond) == static_cast<int>(EnderRules::EQuality::Bond));
static_assert(static_cast<int>(EEnderRoomKind::Elite) == static_cast<int>(EnderRules::ERoomKind::Elite));
static_assert(static_cast<int>(EEnderDropSource::Boss) == static_cast<int>(EnderRules::EDropSource::Boss));
static_assert(static_cast<int>(EEnderEvidenceTier::Witnessed) == static_cast<int>(EnderRules::EEvidenceTier::Witnessed));
static_assert(static_cast<int>(EEnderGearSlot::Charm) == static_cast<int>(EnderRules::EGearSlot::Charm));
static_assert(static_cast<int>(EEnderFamiliarAction::Trial) == static_cast<int>(EnderRules::EFamiliarAction::Trial));
static_assert(static_cast<int>(EEnderHitWeight::Ultimate) == static_cast<int>(EnderRules::EHitWeight::Ultimate));
static_assert(static_cast<int>(EEnderInputPriority::Death) == static_cast<int>(EnderRules::EInputPriority::Death));

namespace EnderConvert
{
	inline EnderRules::EArchetype ToRules(EEnderArchetype V) { return static_cast<EnderRules::EArchetype>(V); }
	inline EnderRules::EEliteModifier ToRules(EEnderEliteModifier V) { return static_cast<EnderRules::EEliteModifier>(V); }
	inline EnderRules::ETokenPool ToRules(EEnderTokenPool V) { return static_cast<EnderRules::ETokenPool>(V); }
	inline EnderRules::ETelegraphClass ToRules(EEnderTelegraphClass V) { return static_cast<EnderRules::ETelegraphClass>(V); }
	inline EnderRules::EQuality ToRules(EEnderQuality V) { return static_cast<EnderRules::EQuality>(V); }
	inline EnderRules::ERoomKind ToRules(EEnderRoomKind V) { return static_cast<EnderRules::ERoomKind>(V); }
	inline EnderRules::EDropSource ToRules(EEnderDropSource V) { return static_cast<EnderRules::EDropSource>(V); }
	inline EnderRules::EEvidenceTier ToRules(EEnderEvidenceTier V) { return static_cast<EnderRules::EEvidenceTier>(V); }
	inline EnderRules::EGearSlot ToRules(EEnderGearSlot V) { return static_cast<EnderRules::EGearSlot>(V); }
	inline EnderRules::EFamiliarAction ToRules(EEnderFamiliarAction V) { return static_cast<EnderRules::EFamiliarAction>(V); }
	inline EnderRules::EHitWeight ToRules(EEnderHitWeight V) { return static_cast<EnderRules::EHitWeight>(V); }
	inline EnderRules::EInputPriority ToRules(EEnderInputPriority V) { return static_cast<EnderRules::EInputPriority>(V); }

	inline EEnderArchetype FromRules(EnderRules::EArchetype V) { return static_cast<EEnderArchetype>(V); }
	inline EEnderEliteModifier FromRules(EnderRules::EEliteModifier V) { return static_cast<EEnderEliteModifier>(V); }
}
