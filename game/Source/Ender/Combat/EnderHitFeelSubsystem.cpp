#include "Combat/EnderHitFeelSubsystem.h"

#include "Camera/EnderCameraRigComponent.h"
#include "Character/EnderCharacterBase.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/WorldSettings.h"
#include "Kismet/GameplayStatics.h"
#include "Rules/CombatRules.h"

void UEnderHitFeelSubsystem::PlayHit(AEnderCharacterBase* Victim, EEnderHitWeight Weight, bool bCrit, bool bFirstUltimateImpact, const FVector& HitDirection)
{
	const EnderRules::FHitFeel Feel = EnderRules::HitFeelFor(EnderConvert::ToRules(Weight), bCrit, bFirstUltimateImpact);

	if (Victim)
	{
		Victim->PlayHitFlash(static_cast<float>(Feel.EnemyFlash));
		if (Feel.EnemyAnimPause > 0) Victim->PauseAnimation(static_cast<float>(Feel.EnemyAnimPause));
	}

	if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
	{
		if (APawn* Pawn = PC->GetPawn())
		{
			if (UEnderCameraRigComponent* Rig = Pawn->FindComponentByClass<UEnderCameraRigComponent>())
			{
				Rig->AddHitKick(HitDirection, static_cast<float>(Feel.CameraTranslation), static_cast<float>(Feel.CameraRotation), static_cast<float>(Feel.ShakeDecay));
			}
		}
	}

	if (Feel.GlobalHitstop > 0)
	{
		UWorld* World = GetWorld();
		const double EndsAt = FPlatformTime::Seconds() + Feel.GlobalHitstop;
		HitstopEndsRealTime = FMath::Max(HitstopEndsRealTime, EndsAt);
		if (!bHitstopActive && World && World->GetWorldSettings())
		{
			bHitstopActive = true;
			World->GetWorldSettings()->SetTimeDilation(HitstopDilation);
		}
	}
}

void UEnderHitFeelSubsystem::Tick(float /*DeltaTime*/)
{
	if (!bHitstopActive) return;
	if (FPlatformTime::Seconds() >= HitstopEndsRealTime)
	{
		bHitstopActive = false;
		if (UWorld* World = GetWorld())
			if (AWorldSettings* WS = World->GetWorldSettings()) WS->SetTimeDilation(1.f);
	}
}
