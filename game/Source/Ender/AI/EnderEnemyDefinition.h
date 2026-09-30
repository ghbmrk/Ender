#pragma once

#include "Engine/DataAsset.h"
#include "AI/EnderAITypes.h"
#include "Core/EnderTypes.h"
#include "EnderEnemyDefinition.generated.h"

class AEnderEnemyCharacter;
class UAnimMontage;
class UNiagaraSystem;
class USoundBase;
class UStateTree;

/** One telegraphed enemy attack. Shape parameters feed both the telegraph and the damage query. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderEnemyAttackSpec
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack") EEnderAttackDelivery Delivery = EEnderAttackDelivery::Strike;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack") EEnderTokenPool TokenPool = EEnderTokenPool::Melee;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack") EEnderTelegraphClass TelegraphClass = EEnderTelegraphClass::MinorMelee;
	/** Raised to the class minimum at runtime if authored lower. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack", meta = (ClampMin = "0.4", Units = "s")) float TelegraphSeconds = 0.43f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack", meta = (ClampMin = "0", Units = "s")) float RecoverySeconds = 0.75f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack", meta = (ClampMin = "0", Units = "s")) float CooldownSeconds = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack", meta = (ClampMin = "0")) float Damage = 10.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack") EEnderHitWeight HitWeight = EEnderHitWeight::Normal;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Shape") EEnderTelegraphShape Shape = EEnderTelegraphShape::Cone;
	/** Distance at which the enemy may start the attack: cone reach, lane length, or cast distance of a placed circle. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Shape", meta = (Units = "cm")) float Range = 160.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Shape", meta = (EditCondition = "Shape == EEnderTelegraphShape::Cone")) float ArcDegrees = 90.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Shape", meta = (Units = "cm", EditCondition = "Shape == EEnderTelegraphShape::Lane")) float Width = 80.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Shape", meta = (Units = "cm", EditCondition = "Shape == EEnderTelegraphShape::Circle")) float Radius = 0.f;
	/** Circle drawn under the target (Seer) instead of around the attacker (Keeper slam). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Shape", meta = (EditCondition = "Shape == EEnderTelegraphShape::Circle")) bool bPlaceAtTarget = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<UAnimMontage> WindupMontage;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<UAnimMontage> ExecuteMontage;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<UNiagaraSystem> ExecuteNiagara;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<USoundBase> WindupSound;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<USoundBase> ExecuteSound;
};

/**
 * Everything numeric about one kind of Hushed enemy (and the Bound King's base
 * stats). Defaults come from EnderRules::DefaultStats; the asset generator
 * (Tools/Python/create_ender_assets.py) calls ApplyRuleDefaults on fresh assets.
 */
UCLASS(BlueprintType)
class ENDER_API UEnderEnemyDefinition : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	virtual FPrimaryAssetId GetPrimaryAssetId() const override;

	/** Fills every numeric field from the engine-free rules for Archetype. Cues and classes are left alone. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Enemy")
	static void ApplyRuleDefaults(UEnderEnemyDefinition* Definition, EEnderArchetype InArchetype);

	UFUNCTION(CallInEditor, Category = "Ender|Enemy")
	void ResetToRuleDefaults();

	const FEnderEnemyAttackSpec& GetAttack(EEnderAttackSlot Slot) const { return Slot == EEnderAttackSlot::Heavy && bHasHeavyAttack ? HeavyAttack : PrimaryAttack; }

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity") EEnderArchetype Archetype = EEnderArchetype::Husk;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity") TSubclassOf<AEnderEnemyCharacter> EnemyClass;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity") FText DisplayName;
	/** Tree run by AEnderAIController. Content/AI/STATETREE_LAYOUT.md describes the expected layout. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Identity") TObjectPtr<UStateTree> StateTree;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats", meta = (ClampMin = "1")) float MaxHealth = 90.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats", meta = (ClampMin = "0")) float Armor = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats", meta = (ClampMin = "0")) float MoveSpeed = 420.f;
	/** Threat-budget cost used by the encounter planner. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats", meta = (ClampMin = "1")) int32 ThreatCost = 1;
	/** Ranged enemies hold between these; 0 means close to attack range. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats", meta = (Units = "cm")) float PreferredRangeMin = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats", meta = (Units = "cm")) float PreferredRangeMax = 0.f;
	/** Stagger attribute at which a Binder hit staggers this enemy. Tuning, not spec. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats", meta = (ClampMin = "1")) float StaggerThreshold = 40.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats", meta = (ClampMin = "0", Units = "s")) float StaggerSeconds = 0.9f;
	/** Keeper: capsule uses the EnderKeeper profile, which blocks enemy projectiles. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Stats") bool bBlocksEnemyProjectiles = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attacks") FEnderEnemyAttackSpec PrimaryAttack;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attacks") bool bHasHeavyAttack = false;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attacks", meta = (EditCondition = "bHasHeavyAttack")) FEnderEnemyAttackSpec HeavyAttack;

	/** Hound: orbit time before the first leap, and how long the leap takes to cross its lane. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Archetype|Hound", meta = (Units = "s")) float MinOrbitBeforeFirstAttack = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Archetype|Hound", meta = (Units = "s")) float LeapSeconds = 0.28f;

	/** Wisp (and any projectile attack). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Archetype|Wisp", meta = (ClampMin = "0")) float ProjectileSpeed = 900.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Archetype|Wisp", meta = (Units = "cm")) float ProjectileRadius = 20.f;

	/** Seer hazard pool. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Archetype|Seer", meta = (Units = "s")) float HazardActivationDelay = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Archetype|Seer", meta = (Units = "s")) float HazardDuration = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Archetype|Seer") float HazardDamagePerSecond = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Archetype|Seer") int32 MaxHazardPools = 0;

	/** Kills bias Form selection toward these qualities. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Rewards") TArray<EEnderQuality> FormBias;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<UAnimMontage> HitReactMontage;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<UAnimMontage> StaggerMontage;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<UNiagaraSystem> SpawnNiagara;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cues") TObjectPtr<USoundBase> DeathSound;
};
