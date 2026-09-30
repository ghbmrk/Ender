#include "AI/EnderHazardPool.h"

#include "AI/EnderAISettings.h"
#include "Combat/EnderCombatStatics.h"
#include "Combat/EnderTargetSweepComponent.h"
#include "Components/DecalComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Rules/EnemyAIRules.h"

AEnderHazardPool::AEnderHazardPool()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = false;
	SetCanBeDamaged(false);

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	Decal = CreateDefaultSubobject<UDecalComponent>(TEXT("Decal"));
	Decal->SetupAttachment(Root);
	Decal->SetRelativeRotation(FRotator(-90.f, 0.f, 0.f));
	Decal->SetFadeScreenSize(0.f);
	Decal->SetHiddenInGame(true);

	TargetSweep = CreateDefaultSubobject<UEnderTargetSweepComponent>(TEXT("TargetSweep"));
	TargetSweep->Team = EEnderSweepTeam::Player;

	SetActorHiddenInGame(true);
}

void AEnderHazardPool::BeginPlay()
{
	Super::BeginPlay();
	if (DecalMaterial)
	{
		Decal->SetDecalMaterial(DecalMaterial);
		Material = Decal->CreateDynamicMaterialInstance();
	}
}

void AEnderHazardPool::Begin(AActor* InSource, const FVector& Center, float InRadius, float InActivationDelay, float InDuration, float DamagePerSecond)
{
	Source = InSource;
	Radius = InRadius;
	ActivationDelay = FMath::Max(0.f, InActivationDelay);
	Duration = FMath::Max(0.f, InDuration);
	DamagePerTick = static_cast<float>(EnderRules::HazardTicks::DamagePerTick(DamagePerSecond));
	TicksTotal = EnderRules::HazardTicks::Count(Duration);
	TicksDealt = 0;
	Elapsed = 0.f;
	bActivated = false;
	bLive = true;

	SetActorLocation(Center);
	Decal->DecalSize = FVector(150.f, Radius, Radius);
	Decal->MarkRenderStateDirty();
	if (Material)
	{
		Material->SetScalarParameterValue(TEXT("Shape"), 0.f);
		Material->SetScalarParameterValue(TEXT("Radius"), Radius);
		Material->SetScalarParameterValue(TEXT("HalfForward"), Radius);
		Material->SetScalarParameterValue(TEXT("HalfSide"), Radius);
		Material->SetScalarParameterValue(TEXT("Progress"), 1.f);
		Material->SetScalarParameterValue(TEXT("Fill"), static_cast<float>(EnderRules::TelegraphLook::WindupFill));
		Material->SetScalarParameterValue(TEXT("FlashCream"), 0.f);
		const bool bColourblind = UEnderAccessibilitySettings::IsColourblindTelegraphs();
		Material->SetScalarParameterValue(TEXT("Hatch"), bColourblind ? 1.f : 0.f);
		Material->SetScalarParameterValue(TEXT("PerimeterPx"), static_cast<float>(bColourblind
			? EnderRules::TelegraphLook::ColourblindPerimeterPx : EnderRules::TelegraphLook::PerimeterPx));
		Material->SetVectorParameterValue(TEXT("DangerColor"), FLinearColor(
			static_cast<float>(EnderRules::TelegraphLook::DangerR),
			static_cast<float>(EnderRules::TelegraphLook::DangerG),
			static_cast<float>(EnderRules::TelegraphLook::DangerB), 1.f));
	}
	Decal->SetHiddenInGame(false);
	SetActorHiddenInGame(false);
	SetActorTickEnabled(true);
	TargetSweep->BeginExecution();
	OnHazardBegin(Radius, Duration);
}

void AEnderHazardPool::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!bLive) return;
	Elapsed += DeltaSeconds;

	if (!bActivated && Elapsed >= ActivationDelay)
	{
		bActivated = true;
		if (Material) Material->SetScalarParameterValue(TEXT("Fill"), static_cast<float>(EnderRules::TelegraphLook::ActiveFill));
		OnHazardActivated();
	}

	// Catch up if a long frame skipped a slice; each slice lands at most once.
	while (bLive && TicksDealt < TicksTotal && Elapsed >= EnderRules::HazardTicks::TickTime(ActivationDelay, TicksDealt))
	{
		DealTick();
		++TicksDealt;
	}

	if (Elapsed >= ActivationDelay + Duration)
	{
		OnHazardEnded();
		Deactivate();
	}
}

void AEnderHazardPool::DealTick()
{
	AActor* Attacker = Source.Get();
	if (!Attacker) return;
	FEnderDamageParams Params;
	Params.BaseDamage = DamagePerTick;
	Params.bCanCrit = false;
	for (const FHitResult& Hit : TargetSweep->RadialQuery(GetActorLocation(), Radius, true))
	{
		UEnderCombatStatics::ApplyDamage(Attacker, Hit.GetActor(), Params, Hit);
	}
}

void AEnderHazardPool::Deactivate()
{
	bLive = false;
	bActivated = false;
	Source.Reset();
	TargetSweep->EndExecution();
	Decal->SetHiddenInGame(true);
	SetActorHiddenInGame(true);
	SetActorTickEnabled(false);
}
