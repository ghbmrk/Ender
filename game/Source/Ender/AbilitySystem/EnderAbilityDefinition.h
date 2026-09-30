#pragma once

#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "Core/EnderTypes.h"
#include "EnderAbilityDefinition.generated.h"

class UAnimMontage;
class UTexture2D;

/**
 * Authored ability tuning (§3: Data Assets own ability configuration). One asset per
 * skill; the C++ ability classes are archetypes (melee arc, radial, expanding ring,
 * barrier, sequenced strikes, evade), never one class per skill. Values default to
 * the spec and are generated from Content/Data/abilities.json by the editor tool.
 */
UCLASS(BlueprintType)
class ENDER_API UEnderAbilityDefinition : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity") FGameplayTag AbilityTag;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity") FGameplayTag CooldownTag;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity") FText DisplayName;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity") TSoftObjectPtr<UTexture2D> Icon;
	/** 1–6 on the skill bar, 0 = Evade, -1 = none. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity") int32 InputSlot = -1;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity") EEnderInputPriority Priority = EEnderInputPriority::Skill;

	// Timing (§21). Montage notify states carry the same times; these drive the fallback timeline and validation.
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Timing") float Windup = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Timing") float Active = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Timing") float Recovery = 0.f;
	/** Seconds from start when Evade may cancel; <0 = never. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Timing") float EvadeCancelAt = -1.f;
	/** Seconds from start when another skill may cancel; <0 = never. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Timing") float SkillCancelAt = -1.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Timing") float MoveMulWindup = 1.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Timing") float MoveMulActive = 1.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Timing") float MoveMulRecovery = 1.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Cost") float Cooldown = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Cost") float ThreadCost = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Cost") float ThreadGain = 0.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Damage") float Damage = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Damage") float Stagger = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Damage") EEnderHitWeight HitWeight = EEnderHitWeight::Normal;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Damage") FGameplayTag DamageType;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shape") float Range = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shape") float ArcDegrees = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shape") float Radius = 0.f;
	/** Unravel: radius at the start of expansion (end = Radius). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shape") float StartRadius = 0.f;
	/** Sever lunge / Evade distance. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shape") float Distance = 0.f;
	/** Grand Fracture: strike distances along aim, and delay between strikes. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shape") TArray<float> StrikeDistances;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shape") float StrikeDelay = 0.f;

	/** Thread Lash third-strike variant. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combo") float ComboWindow = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combo") float ComboDamage = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combo") float ComboStagger = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combo") float ComboThreadGain = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combo") TObjectPtr<UAnimMontage> ComboMontage;

	/** Bind (§25): per target class. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Control") float NormalPull = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Control") float NormalRoot = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Control") float ElitePull = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Control") float EliteSlow = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Control") float EliteDuration = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Control") float EliteStagger = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Control") float BossStagger = 0.f;

	/** Warding Sigil (§27). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Defense") float BarrierFractionOfMaxHealth = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Defense") float EffectDuration = 0.f;

	/** Draught heal (§33). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Defense") float Heal = 0.f;

	/** Evade invulnerability window (§29), seconds from start. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Defense") float InvulnStart = 0.f;
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Defense") float InvulnEnd = 0.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation") TObjectPtr<UAnimMontage> Montage;
	/** Gameplay cue for the ability VFX/SFX (NS_ThreadLash, NS_Sever, …). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation") FGameplayTag CueTag;

	float Total() const { return Windup + Active + Recovery; }
	bool CanDealDamageAt(float T) const { return T >= Windup && T < Windup + Active; }

	virtual FPrimaryAssetId GetPrimaryAssetId() const override { return FPrimaryAssetId(TEXT("EnderAbility"), GetFName()); }
};
