#pragma once

#include "AttributeSet.h"
#include "AbilitySystemComponent.h"
#include "EnderAttributeSet.generated.h"

#define ENDER_ATTRIBUTE_ACCESSORS(ClassName, PropertyName) \
	GAMEPLAYATTRIBUTE_PROPERTY_GETTER(ClassName, PropertyName) \
	GAMEPLAYATTRIBUTE_VALUE_GETTER(PropertyName) \
	GAMEPLAYATTRIBUTE_VALUE_SETTER(PropertyName) \
	GAMEPLAYATTRIBUTE_VALUE_INITTER(PropertyName)

struct FEnderDamageEvent;

/**
 * §19 attributes, shared by the Binder and the Hushed.
 *
 * AttackPower is the gear multiplier (1.0 = no gear), so
 * rawDamage = base × AttackPower × temporary (§30). IncomingDamage and
 * IncomingStagger are meta attributes written only by UEnderDamageExecution;
 * PostGameplayEffectExecute turns them into Barrier/Health/Stagger changes.
 */
UCLASS()
class ENDER_API UEnderAttributeSet : public UAttributeSet
{
	GENERATED_BODY()

public:
	UEnderAttributeSet();

	UPROPERTY(BlueprintReadOnly, Category = "Vitals") FGameplayAttributeData Health;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, Health)
	UPROPERTY(BlueprintReadOnly, Category = "Vitals") FGameplayAttributeData MaxHealth;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, MaxHealth)
	UPROPERTY(BlueprintReadOnly, Category = "Vitals") FGameplayAttributeData Thread;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, Thread)
	UPROPERTY(BlueprintReadOnly, Category = "Vitals") FGameplayAttributeData MaxThread;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, MaxThread)
	UPROPERTY(BlueprintReadOnly, Category = "Offense") FGameplayAttributeData AttackPower;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, AttackPower)
	UPROPERTY(BlueprintReadOnly, Category = "Defense") FGameplayAttributeData Armor;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, Armor)
	UPROPERTY(BlueprintReadOnly, Category = "Offense") FGameplayAttributeData CritChance;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, CritChance)
	UPROPERTY(BlueprintReadOnly, Category = "Offense") FGameplayAttributeData CritMultiplier;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, CritMultiplier)
	UPROPERTY(BlueprintReadOnly, Category = "Movement") FGameplayAttributeData MoveSpeed;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, MoveSpeed)
	UPROPERTY(BlueprintReadOnly, Category = "Defense") FGameplayAttributeData Barrier;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, Barrier)
	UPROPERTY(BlueprintReadOnly, Category = "Defense") FGameplayAttributeData Stagger;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, Stagger)
	UPROPERTY(BlueprintReadOnly, Category = "Defense") FGameplayAttributeData MaxStagger;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, MaxStagger)

	/** Cooldown reduction from the Sigil slot, 0–0.25. Not in §19's list; gear needs a home for it. */
	UPROPERTY(BlueprintReadOnly, Category = "Offense") FGameplayAttributeData CooldownReduction;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, CooldownReduction)

	UPROPERTY(BlueprintReadOnly, Category = "Meta") FGameplayAttributeData IncomingDamage;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, IncomingDamage)
	UPROPERTY(BlueprintReadOnly, Category = "Meta") FGameplayAttributeData IncomingStagger;
	ENDER_ATTRIBUTE_ACCESSORS(UEnderAttributeSet, IncomingStagger)

	virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
	virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;
};
