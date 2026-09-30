#include "AbilitySystem/EnderAttributeSet.h"

#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "AbilitySystem/EnderGameplayEffectContext.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "GameplayEffectExtension.h"
#include "Rules/CombatRules.h"

UEnderAttributeSet::UEnderAttributeSet()
{
	InitMaxHealth(EnderRules::Binder::BaseHealth);
	InitHealth(EnderRules::Binder::BaseHealth);
	InitMaxThread(EnderRules::Thread::Max);
	InitThread(EnderRules::Thread::RoomStart);
	InitAttackPower(1.f);
	InitArmor(0.f);
	InitCritChance(EnderRules::Damage::BaseCritChance);
	InitCritMultiplier(EnderRules::Damage::BaseCritMultiplier);
	InitMoveSpeed(EnderRules::Binder::MaxSpeed);
	InitBarrier(0.f);
	InitStagger(0.f);
	InitMaxStagger(100.f);
	InitCooldownReduction(0.f);
	InitIncomingDamage(0.f);
	InitIncomingStagger(0.f);
}

void UEnderAttributeSet::PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue)
{
	Super::PreAttributeChange(Attribute, NewValue);
	if (Attribute == GetHealthAttribute()) NewValue = FMath::Clamp(NewValue, 0.f, GetMaxHealth());
	else if (Attribute == GetThreadAttribute()) NewValue = FMath::Clamp(NewValue, 0.f, GetMaxThread());
	else if (Attribute == GetBarrierAttribute()) NewValue = FMath::Max(0.f, NewValue);
	else if (Attribute == GetStaggerAttribute()) NewValue = FMath::Clamp(NewValue, 0.f, GetMaxStagger());
	else if (Attribute == GetCritChanceAttribute()) NewValue = FMath::Clamp(NewValue, 0.f, 1.f);
	else if (Attribute == GetCooldownReductionAttribute()) NewValue = FMath::Clamp(NewValue, 0.f, 0.25f);
}

void UEnderAttributeSet::PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data)
{
	Super::PostGameplayEffectExecute(Data);

	UEnderAbilitySystemComponent* ASC = Cast<UEnderAbilitySystemComponent>(GetOwningAbilitySystemComponent());
	if (!ASC) return;

	if (Data.EvaluatedData.Attribute == GetIncomingDamageAttribute())
	{
		const float Incoming = GetIncomingDamage();
		const float StaggerIn = GetIncomingStagger();
		SetIncomingDamage(0.f);
		SetIncomingStagger(0.f);
		if (Incoming <= 0.f || ASC->HasMatchingGameplayTag(EnderTags::State_Dead)) return;

		// Barrier absorbs first (§27).
		double BarrierLeft = GetBarrier();
		const float ToHealth = static_cast<float>(EnderRules::Damage::AbsorbWithBarrier(Incoming, BarrierLeft));
		SetBarrier(static_cast<float>(BarrierLeft));
		const float NewHealth = FMath::Clamp(GetHealth() - ToHealth, 0.f, GetMaxHealth());
		SetHealth(NewHealth);

		if (StaggerIn > 0.f) SetStagger(FMath::Clamp(GetStagger() + StaggerIn, 0.f, GetMaxStagger()));

		FEnderDamageEvent Event;
		Event.Instigator = Data.EffectSpec.GetContext().GetOriginalInstigator();
		Event.Amount = Incoming;
		Event.HealthLost = ToHealth;
		Event.StaggerAdded = StaggerIn;
		Event.bKilled = NewHealth <= 0.f;
		if (const FEnderGameplayEffectContext* Ctx = FEnderGameplayEffectContext::From(Data.EffectSpec.GetContext()))
		{
			Event.bCrit = Ctx->bCrit;
			Event.HitWeight = Ctx->HitWeight;
			Event.bFirstUltimateImpact = Ctx->bFirstUltimateImpact;
			Event.bInterruptsOnBarrier = Ctx->bFromNormalEnemy;
		}
		if (const FHitResult* Hit = Data.EffectSpec.GetContext().GetHitResult()) Event.ImpactPoint = Hit->ImpactPoint;
		ASC->NotifyDamaged(Event);
	}
	else if (Data.EvaluatedData.Attribute == GetHealthAttribute())
	{
		SetHealth(FMath::Clamp(GetHealth(), 0.f, GetMaxHealth()));
	}
	else if (Data.EvaluatedData.Attribute == GetThreadAttribute())
	{
		SetThread(FMath::Clamp(GetThread(), 0.f, GetMaxThread()));
	}
}
