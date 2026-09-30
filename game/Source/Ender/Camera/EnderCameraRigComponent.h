#pragma once

#include "Components/ActorComponent.h"
#include "EnderCameraRigComponent.generated.h"

class USpringArmComponent;
class UCameraComponent;

/**
 * §15–16 fixed isometric camera. Perspective, 38° vertical FOV, yaw 45°, pitch −52°,
 * arm 1550 cm (zoom 1350–1800 in 75 cm steps, 0.18 s ease), target offset Z 90.
 * The focus follows the player plus an aim lookahead (≤135 cm, full at ≥500 cm)
 * through a ~100 ms critically damped spring, never trailing by more than 45 cm.
 * No player camera rotation. Hit kicks (§32) are added on top and decay on real time.
 */
UCLASS(ClassGroup = (Ender), meta = (BlueprintSpawnableComponent))
class ENDER_API UEnderCameraRigComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UEnderCameraRigComponent();

	void Setup(USpringArmComponent* InArm, UCameraComponent* InCamera);

	/** Ground-plane aim point from the controller (mouse or right stick). */
	void SetAimPoint(const FVector& WorldAim) { AimPoint = WorldAim; bHasAim = true; }

	UFUNCTION(BlueprintCallable, Category = "Ender|Camera")
	void Zoom(int32 Notches);

	void AddHitKick(const FVector& Direction, float TranslationCm, float RotationDeg, float Decay);

	/** Snap to the player (room load, teleport). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Camera")
	void SnapToTarget();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UPROPERTY(EditAnywhere, Category = "Ender|Camera") float VerticalFov = 38.f;
	UPROPERTY(EditAnywhere, Category = "Ender|Camera") float Yaw = 45.f;
	UPROPERTY(EditAnywhere, Category = "Ender|Camera") float Pitch = -52.f;
	UPROPERTY(EditAnywhere, Category = "Ender|Camera") float TargetOffsetZ = 90.f;

protected:
	virtual void BeginPlay() override;

private:
	FVector DesiredFocus() const;

	UPROPERTY() TObjectPtr<USpringArmComponent> Arm;
	UPROPERTY() TObjectPtr<UCameraComponent> Camera;

	FVector AimPoint = FVector::ZeroVector;
	bool bHasAim = false;
	FVector Focus = FVector::ZeroVector;
	FVector2D FocusVelocity = FVector2D::ZeroVector;

	float ArmTarget = 1550.f;
	float ArmFrom = 1550.f;
	float ZoomElapsed = 1.f;

	struct FKick
	{
		FVector Direction;
		float Translation;
		float Rotation;
		float Decay;
		float Age;
	};
	TArray<FKick> Kicks;
};
