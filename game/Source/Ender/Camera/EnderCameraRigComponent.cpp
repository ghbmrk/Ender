#include "Camera/EnderCameraRigComponent.h"

#include "Camera/CameraComponent.h"
#include "GameFramework/Actor.h"
#include "GameFramework/SpringArmComponent.h"
#include "Rules/CameraRules.h"

namespace CR = EnderRules::CameraRules;

UEnderCameraRigComponent::UEnderCameraRigComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	// After movement so the camera never lags a frame behind the character.
	PrimaryComponentTick.TickGroup = TG_PostPhysics;
	ArmTarget = ArmFrom = static_cast<float>(CR::ArmDefault);
}

void UEnderCameraRigComponent::Setup(USpringArmComponent* InArm, UCameraComponent* InCamera)
{
	Arm = InArm;
	Camera = InCamera;
	if (Arm)
	{
		Arm->SetUsingAbsoluteLocation(true);
		Arm->SetUsingAbsoluteRotation(true);
		Arm->SetWorldRotation(FRotator(Pitch, Yaw, 0.f));
		Arm->TargetArmLength = ArmTarget;
		Arm->bDoCollisionTest = false;
		Arm->bEnableCameraLag = false;
		Arm->bEnableCameraRotationLag = false;
		Arm->bInheritPitch = Arm->bInheritYaw = Arm->bInheritRoll = false;
	}
	if (Camera)
	{
		Camera->ProjectionMode = ECameraProjectionMode::Perspective;
		Camera->bUsePawnControlRotation = false;
		// UCameraComponent::FieldOfView is horizontal; convert from the spec's 38° vertical at 16:9.
		const double HalfV = FMath::DegreesToRadians(VerticalFov * 0.5);
		Camera->SetFieldOfView(static_cast<float>(FMath::RadiansToDegrees(2.0 * FMath::Atan(FMath::Tan(HalfV) * CR::Aspect))));
		Camera->bConstrainAspectRatio = false;
	}
}

void UEnderCameraRigComponent::BeginPlay()
{
	Super::BeginPlay();
	SnapToTarget();
}

FVector UEnderCameraRigComponent::DesiredFocus() const
{
	const FVector P = GetOwner()->GetActorLocation();
	double LX = 0, LY = 0;
	if (bHasAim) CR::Lookahead(P.X, P.Y, AimPoint.X, AimPoint.Y, LX, LY);
	return FVector(P.X + LX, P.Y + LY, P.Z + TargetOffsetZ);
}

void UEnderCameraRigComponent::SnapToTarget()
{
	Focus = DesiredFocus();
	FocusVelocity = FVector2D::ZeroVector;
	if (Arm) Arm->SetWorldLocation(Focus);
}

void UEnderCameraRigComponent::Zoom(int32 Notches)
{
	const float Current = Arm ? Arm->TargetArmLength : ArmTarget;
	ArmFrom = Current;
	ArmTarget = static_cast<float>(CR::StepZoom(ArmTarget, Notches));
	ZoomElapsed = 0.f;
}

void UEnderCameraRigComponent::AddHitKick(const FVector& Direction, float TranslationCm, float RotationDeg, float Decay)
{
	if (TranslationCm <= 0.f && RotationDeg <= 0.f) return;
	// Keep only a handful: kicks decay in ≤160 ms, more would only add noise.
	if (Kicks.Num() >= 6) Kicks.RemoveAt(0);
	Kicks.Add({Direction.GetSafeNormal2D(), TranslationCm, RotationDeg, Decay, 0.f});
}

void UEnderCameraRigComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	if (!Arm) return;

	// Follow and zoom run on world time (they freeze with hitstop); kicks run on real time.
	const FVector Desired = DesiredFocus();
	double VX = FocusVelocity.X, VY = FocusVelocity.Y;
	double FX = CR::SmoothDamp(Focus.X, Desired.X, VX, CR::FollowSmoothTime, DeltaTime);
	double FY = CR::SmoothDamp(Focus.Y, Desired.Y, VY, CR::FollowSmoothTime, DeltaTime);
	CR::ClampLag(Desired.X, Desired.Y, FX, FY);
	FocusVelocity = FVector2D(VX, VY);
	Focus = FVector(FX, FY, Desired.Z);

	ZoomElapsed += DeltaTime;
	Arm->TargetArmLength = static_cast<float>(CR::ZoomAt(ArmFrom, ArmTarget, ZoomElapsed));

	const float RealDt = FApp::GetDeltaTime();
	FVector KickOffset = FVector::ZeroVector;
	float KickRoll = 0.f;
	for (int32 I = Kicks.Num() - 1; I >= 0; --I)
	{
		FKick& K = Kicks[I];
		K.Age += RealDt;
		if (K.Age >= K.Decay)
		{
			Kicks.RemoveAtSwap(I);
			continue;
		}
		KickOffset += K.Direction * static_cast<float>(CR::KickAt(K.Translation, K.Decay, K.Age));
		KickRoll += static_cast<float>(CR::KickAt(K.Rotation, K.Decay, K.Age)) * ((I % 2) ? 1.f : -1.f);
	}

	Arm->SetWorldLocation(Focus + KickOffset);
	Arm->SetWorldRotation(FRotator(Pitch, Yaw, KickRoll));
}
