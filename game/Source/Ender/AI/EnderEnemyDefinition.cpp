#include "AI/EnderEnemyDefinition.h"

#include "Rules/EnemyAIRules.h"
#include "Rules/EnemyRules.h"

namespace
{
	void FillAttack(FEnderEnemyAttackSpec& Out, const EnderRules::FEnemyAttack& In)
	{
		Out.Delivery = EEnderAttackDelivery::Strike;
		Out.TokenPool = static_cast<EEnderTokenPool>(In.Pool);
		Out.TelegraphClass = static_cast<EEnderTelegraphClass>(In.Class);
		Out.TelegraphSeconds = static_cast<float>(In.Telegraph);
		Out.RecoverySeconds = static_cast<float>(In.Recovery);
		Out.CooldownSeconds = static_cast<float>(In.Cooldown);
		Out.Damage = static_cast<float>(In.Damage);
		Out.Range = static_cast<float>(In.Range);
		Out.HitWeight = In.Class == EnderRules::ETelegraphClass::Heavy ? EEnderHitWeight::Heavy : EEnderHitWeight::Normal;
	}
}

FPrimaryAssetId UEnderEnemyDefinition::GetPrimaryAssetId() const
{
	return FPrimaryAssetId(TEXT("EnderEnemy"), GetFName());
}

void UEnderEnemyDefinition::ResetToRuleDefaults()
{
	Modify();
	ApplyRuleDefaults(this, Archetype);
}

void UEnderEnemyDefinition::ApplyRuleDefaults(UEnderEnemyDefinition* D, EEnderArchetype InArchetype)
{
	if (!D) return;
	D->Archetype = InArchetype;

	if (InArchetype == EEnderArchetype::BoundKing)
	{
		// Attacks live in Rules/BossRules.h and on AEnderBoundKing; see BossTuning for the health.
		D->DisplayName = NSLOCTEXT("Ender", "BoundKing", "The Bound King");
		D->MaxHealth = static_cast<float>(EnderRules::BossTuning::MaxHealth);
		D->Armor = 0.f;
		D->MoveSpeed = 380.f;
		D->ThreatCost = 1;
		D->StaggerThreshold = static_cast<float>(EnderRules::BoundKing::StaggerMax);
		D->StaggerSeconds = static_cast<float>(EnderRules::BoundKing::StaggerDuration);
		D->bHasHeavyAttack = false;
		D->FormBias.Reset();
		return;
	}

	const EnderRules::FArchetypeStats S = EnderRules::DefaultStats(EnderConvert::ToRules(InArchetype));
	D->DisplayName = FText::FromString(UTF8_TO_TCHAR(S.Name));
	D->MaxHealth = static_cast<float>(S.Health);
	D->Armor = static_cast<float>(S.Armor);
	D->MoveSpeed = static_cast<float>(S.MoveSpeed);
	D->ThreatCost = S.Cost;
	D->PreferredRangeMin = static_cast<float>(S.PreferredRangeMin);
	D->PreferredRangeMax = static_cast<float>(S.PreferredRangeMax);
	D->bBlocksEnemyProjectiles = S.bBlocksEnemyProjectiles;
	D->StaggerThreshold = 40.f;
	D->StaggerSeconds = 0.9f;
	D->MinOrbitBeforeFirstAttack = 0.f;
	D->HazardActivationDelay = D->HazardDuration = D->HazardDamagePerSecond = 0.f;
	D->MaxHazardPools = 0;

	FillAttack(D->PrimaryAttack, S.Primary);
	D->bHasHeavyAttack = S.bHasHeavy;
	if (S.bHasHeavy) FillAttack(D->HeavyAttack, S.Heavy);

	FEnderEnemyAttackSpec& P = D->PrimaryAttack;
	switch (InArchetype)
	{
	case EEnderArchetype::Husk:
		P.Shape = EEnderTelegraphShape::Cone;
		P.ArcDegrees = 90.f;
		break;
	case EEnderArchetype::Hound:
		P.Delivery = EEnderAttackDelivery::Leap;
		P.Shape = EEnderTelegraphShape::Lane;
		P.Width = 90.f;
		D->MinOrbitBeforeFirstAttack = static_cast<float>(EnderRules::Hound::MinOrbitBeforeFirstLeap);
		D->LeapSeconds = 0.28f;
		break;
	case EEnderArchetype::Wisp:
		P.Delivery = EEnderAttackDelivery::Projectile;
		P.Shape = EEnderTelegraphShape::Lane;
		D->ProjectileSpeed = static_cast<float>(EnderRules::Wisp::ProjectileSpeed);
		D->ProjectileRadius = 20.f;
		P.Width = D->ProjectileRadius * 2.f;
		break;
	case EEnderArchetype::Keeper:
		P.Shape = EEnderTelegraphShape::Cone;
		P.ArcDegrees = 110.f;
		// Heavy slam: a disc around the Keeper; it starts the windup a little inside the disc's edge.
		D->HeavyAttack.Shape = EEnderTelegraphShape::Circle;
		D->HeavyAttack.Radius = D->HeavyAttack.Range;
		D->HeavyAttack.Range = D->HeavyAttack.Radius * 0.85f;
		D->HeavyAttack.bPlaceAtTarget = false;
		D->StaggerThreshold = 70.f;
		break;
	case EEnderArchetype::Seer:
		P.Delivery = EEnderAttackDelivery::Hazard;
		P.Shape = EEnderTelegraphShape::Circle;
		P.Radius = static_cast<float>(EnderRules::Seer::HazardRadius);
		P.bPlaceAtTarget = true;
		D->HazardActivationDelay = static_cast<float>(EnderRules::Seer::ActivationDelay);
		D->HazardDuration = static_cast<float>(EnderRules::Seer::HazardDuration);
		D->HazardDamagePerSecond = static_cast<float>(EnderRules::Seer::HazardDps);
		D->MaxHazardPools = EnderRules::Seer::MaxPoolsPerSeer;
		break;
	default:
		break;
	}

	D->FormBias.Reset();
	for (EnderRules::EQuality Q : S.Bias)
	{
		if (Q != EnderRules::EQuality::Count) D->FormBias.Add(static_cast<EEnderQuality>(Q));
	}
}
