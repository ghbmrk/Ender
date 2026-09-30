#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "GameplayTagContainer.h"
#include "Core/EnderTypes.h"
#include "EnderCombatStatics.generated.h"

class UAbilitySystemComponent;

/** One hit's inputs. Base values come from the ability/enemy Data Asset. */
USTRUCT(BlueprintType)
struct ENDER_API FEnderDamageParams
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite) float BaseDamage = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float Stagger = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float TemporaryMultiplier = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) EEnderHitWeight HitWeight = EEnderHitWeight::Normal;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bFirstUltimateImpact = false;
	/** Enemies never crit; the Binder rolls from the run's crit stream. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bCanCrit = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FGameplayTag DamageType;
};

UCLASS()
class ENDER_API UEnderCombatStatics : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * The only path damage takes. Rolls the crit deterministically (run crit stream,
	 * source CritChance), fills the effect context, applies UEnderGE_Damage.
	 * Returns false when the target has no ability system or is dead/invulnerable.
	 */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat", meta = (DefaultToSelf = "Source"))
	static bool ApplyDamage(AActor* Source, AActor* Target, const FEnderDamageParams& Params, const FHitResult& Hit);

	/** Timed status tag (Effect.Root, Effect.Slow, State.Invulnerable, Effect.Barrier…). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	static void ApplyStatusTag(AActor* Source, AActor* Target, FGameplayTag Tag, float Duration);

	/** MoveSpeed × Scale for Duration (Bind's elite slow: 0.65). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	static void ApplyMoveSpeedScale(AActor* Source, AActor* Target, float Scale, float Duration);

	UFUNCTION(BlueprintCallable, Category = "Ender|Combat")
	static void AddThread(AActor* Target, float Delta);

	UFUNCTION(BlueprintPure, Category = "Ender|Combat")
	static bool IsAlive(const AActor* Actor);

	UFUNCTION(BlueprintPure, Category = "Ender|Combat")
	static bool HasTag(const AActor* Actor, FGameplayTag Tag);

	static UAbilitySystemComponent* ASCOf(const AActor* Actor);
};
