#include "AI/EnderTelegraph.h"

#include "AI/EnderAISettings.h"
#include "Components/DecalComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Rules/EnemyAIRules.h"

namespace EnderTelegraphParams
{
	static const FName Shape(TEXT("Shape"));
	static const FName Radius(TEXT("Radius"));
	static const FName ArcDegrees(TEXT("ArcDegrees"));
	static const FName Length(TEXT("Length"));
	static const FName Width(TEXT("Width"));
	static const FName HalfForward(TEXT("HalfForward"));
	static const FName HalfSide(TEXT("HalfSide"));
	static const FName Progress(TEXT("Progress"));
	static const FName Fill(TEXT("Fill"));
	static const FName FlashCream(TEXT("FlashCream"));
	static const FName Hatch(TEXT("Hatch"));
	static const FName PerimeterPx(TEXT("PerimeterPx"));
	static const FName DangerColor(TEXT("DangerColor"));
}

AEnderTelegraph::AEnderTelegraph()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = false;
	SetCanBeDamaged(false);

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	Decal = CreateDefaultSubobject<UDecalComponent>(TEXT("Decal"));
	Decal->SetupAttachment(Root);
	// Project straight down: the decal's X axis points at the floor, its Z axis along the shape's forward.
	Decal->SetRelativeRotation(FRotator(-90.f, 0.f, 0.f));
	Decal->SetFadeScreenSize(0.f);
	Decal->SetHiddenInGame(true);
}

void AEnderTelegraph::BeginPlay()
{
	Super::BeginPlay();
	if (DecalMaterial)
	{
		Decal->SetDecalMaterial(DecalMaterial);
		Material = Decal->CreateDynamicMaterialInstance();
	}
	bColourblind = UEnderAccessibilitySettings::IsColourblindTelegraphs();
	ColourblindHandle = UEnderAccessibilitySettings::OnColourblindChanged.AddUObject(this, &AEnderTelegraph::HandleColourblindChanged);
}

void AEnderTelegraph::EndPlay(const EEndPlayReason::Type Reason)
{
	UEnderAccessibilitySettings::OnColourblindChanged.Remove(ColourblindHandle);
	OnResolved.Clear();
	Super::EndPlay(Reason);
}

void AEnderTelegraph::Begin(const FEnderTelegraphShape& InShape, float InDuration, AActor* InSource)
{
	// Listeners of the previous use are dropped here, never mid-broadcast.
	OnResolved.Clear();
	Shape = InShape;
	Duration = FMath::Max(0.f, InDuration);
	Elapsed = 0.f;
	Source = InSource;
	bLive = true;
	bActivated = false;
	bHoldAfterActivation = false;

	SetActorLocationAndRotation(Shape.DrawCenter(), FRotator(0.f, Shape.Direction.Rotation().Yaw, 0.f));
	PushShapeParams();
	PushLook();
	Decal->SetHiddenInGame(false);
	SetActorHiddenInGame(false);
	SetActorTickEnabled(true);
	OnTelegraphBegin(Shape.Shape, Duration);
}

void AEnderTelegraph::PushShapeParams()
{
	const FVector2D Half = Shape.DrawHalfExtents();
	// Decal size is (projection depth, side half extent, forward half extent) in the rotated frame.
	Decal->DecalSize = FVector(ProjectionHalfDepth, FMath::Max(1.0, Half.Y), FMath::Max(1.0, Half.X));
	Decal->MarkRenderStateDirty();
	if (!Material) return;

	using namespace EnderTelegraphParams;
	Material->SetScalarParameterValue(EnderTelegraphParams::Shape, static_cast<float>(Shape.Shape));
	Material->SetScalarParameterValue(Radius, Shape.Radius);
	Material->SetScalarParameterValue(ArcDegrees, Shape.ArcDegrees);
	Material->SetScalarParameterValue(Length, Shape.Length);
	Material->SetScalarParameterValue(Width, Shape.Width);
	Material->SetScalarParameterValue(HalfForward, static_cast<float>(Half.X));
	Material->SetScalarParameterValue(HalfSide, static_cast<float>(Half.Y));
	Material->SetVectorParameterValue(DangerColor, FLinearColor(
		static_cast<float>(EnderRules::TelegraphLook::DangerR),
		static_cast<float>(EnderRules::TelegraphLook::DangerG),
		static_cast<float>(EnderRules::TelegraphLook::DangerB), 1.f));
}

void AEnderTelegraph::PushLook()
{
	if (!Material) return;
	const EnderRules::TelegraphLook::FState Look = EnderRules::TelegraphLook::At(Elapsed, Duration);
	Material->SetScalarParameterValue(EnderTelegraphParams::Progress, static_cast<float>(Look.Progress));
	Material->SetScalarParameterValue(EnderTelegraphParams::Fill, static_cast<float>(Look.Fill));
	Material->SetScalarParameterValue(EnderTelegraphParams::FlashCream, static_cast<float>(Look.Flash));
	Material->SetScalarParameterValue(EnderTelegraphParams::Hatch, bColourblind ? 1.f : 0.f);
	Material->SetScalarParameterValue(EnderTelegraphParams::PerimeterPx, static_cast<float>(bColourblind
		? EnderRules::TelegraphLook::ColourblindPerimeterPx : EnderRules::TelegraphLook::PerimeterPx));
}

void AEnderTelegraph::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!bLive) return;

	Elapsed += DeltaSeconds;
	PushLook();

	if (!bActivated && Elapsed >= Duration)
	{
		bActivated = true;
		OnTelegraphActivated();
		OnResolved.Broadcast(this);
		return;
	}

	if (bActivated && !bHoldAfterActivation && Elapsed - Duration >= LingerSeconds)
	{
		Finish(false);
	}
}

void AEnderTelegraph::Release()
{
	if (!bLive) return;
	if (!bActivated)
	{
		Cancel();
		return;
	}
	bHoldAfterActivation = false;
	// Let the flash finish if it is still showing; Tick ends it after the linger.
	if (Elapsed - Duration >= LingerSeconds) Finish(false);
}

void AEnderTelegraph::Cancel()
{
	if (bLive) Finish(true);
}

void AEnderTelegraph::Finish(bool bCancelled)
{
	OnTelegraphEnded(bCancelled);
	Deactivate();
}

void AEnderTelegraph::Deactivate()
{
	bLive = false;
	bActivated = false;
	bHoldAfterActivation = false;
	Source.Reset();
	Decal->SetHiddenInGame(true);
	SetActorHiddenInGame(true);
	SetActorTickEnabled(false);
}

void AEnderTelegraph::HandleColourblindChanged(bool bEnabled)
{
	bColourblind = bEnabled;
	if (bLive) PushLook();
}
