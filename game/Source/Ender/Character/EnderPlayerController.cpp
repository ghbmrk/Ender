#include "Character/EnderPlayerController.h"

#include "Camera/EnderCameraRigComponent.h"
#include "Character/EnderPlayerCharacter.h"
#include "Combat/EnderCombatInputBuffer.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "Rules/CameraRules.h"

namespace
{
	const TCHAR* SkillPaths[] = {
		TEXT("/Game/Input/IA_Skill1.IA_Skill1"), TEXT("/Game/Input/IA_Skill2.IA_Skill2"), TEXT("/Game/Input/IA_Skill3.IA_Skill3"),
		TEXT("/Game/Input/IA_Skill4.IA_Skill4"), TEXT("/Game/Input/IA_Skill5.IA_Skill5"), TEXT("/Game/Input/IA_Skill6.IA_Skill6"),
	};
}

AEnderPlayerController::AEnderPlayerController()
{
	bShowMouseCursor = true;
	DefaultMouseCursor = EMouseCursor::Crosshairs;
	// Defaults match the assets Tools/Python/create_ender_assets.py generates; a Blueprint subclass may override.
	MappingContext = TSoftObjectPtr<UInputMappingContext>(FSoftObjectPath(TEXT("/Game/Input/IMC_Binder.IMC_Binder")));
	MoveAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_Move.IA_Move")));
	AimStickAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_AimStick.IA_AimStick")));
	for (const TCHAR* Path : SkillPaths) SkillActions.Add(TSoftObjectPtr<UInputAction>(FSoftObjectPath(Path)));
	EvadeAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_Evade.IA_Evade")));
	DraughtAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_Draught.IA_Draught")));
	InteractAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_Interact.IA_Interact")));
	InventoryAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_Inventory.IA_Inventory")));
	MapAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_Map.IA_Map")));
	LootLabelsAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_LootLabels.IA_LootLabels")));
	ZoomAction = TSoftObjectPtr<UInputAction>(FSoftObjectPath(TEXT("/Game/Input/IA_Zoom.IA_Zoom")));
}

AEnderPlayerCharacter* AEnderPlayerController::Binder() const
{
	return Cast<AEnderPlayerCharacter>(GetPawn());
}

void AEnderPlayerController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	if (UEnhancedInputLocalPlayerSubsystem* Sub = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
	{
		if (UInputMappingContext* IMC = MappingContext.LoadSynchronous())
		{
			Sub->ClearAllMappings();
			Sub->AddMappingContext(IMC, 0);
		}
	}
}

void AEnderPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();
	UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(InputComponent);
	if (!EIC) return;

	auto Bind = [EIC, this](const TSoftObjectPtr<UInputAction>& Soft, ETriggerEvent Event, void (AEnderPlayerController::*Fn)(const FInputActionValue&)) {
		if (UInputAction* Action = Soft.LoadSynchronous()) EIC->BindAction(Action, Event, this, Fn);
	};

	Bind(MoveAction, ETriggerEvent::Triggered, &AEnderPlayerController::Move);
	Bind(MoveAction, ETriggerEvent::Completed, &AEnderPlayerController::MoveStopped);
	Bind(AimStickAction, ETriggerEvent::Triggered, &AEnderPlayerController::AimStick);
	Bind(EvadeAction, ETriggerEvent::Started, &AEnderPlayerController::Evade);
	Bind(DraughtAction, ETriggerEvent::Started, &AEnderPlayerController::Draught);
	Bind(InteractAction, ETriggerEvent::Started, &AEnderPlayerController::Interact);
	Bind(InventoryAction, ETriggerEvent::Started, &AEnderPlayerController::Inventory);
	Bind(MapAction, ETriggerEvent::Started, &AEnderPlayerController::Map);
	Bind(LootLabelsAction, ETriggerEvent::Started, &AEnderPlayerController::LootLabelsOn);
	Bind(LootLabelsAction, ETriggerEvent::Completed, &AEnderPlayerController::LootLabelsOff);
	Bind(ZoomAction, ETriggerEvent::Triggered, &AEnderPlayerController::Zoom);

	for (int32 Slot = 0; Slot < SkillActions.Num(); ++Slot)
	{
		if (UInputAction* Action = SkillActions[Slot].LoadSynchronous())
		{
			// Triggered fires every frame while held, so holding refreshes the buffered press.
			EIC->BindAction(Action, ETriggerEvent::Triggered, this, &AEnderPlayerController::Skill, Slot);
		}
	}
}

FVector AEnderPlayerController::CameraRelative(const FVector2D& Input) const
{
	const FVector Forward = FRotator(0.f, EnderRules::CameraRules::Yaw, 0.f).Vector();
	const FVector Right = FRotator(0.f, EnderRules::CameraRules::Yaw + 90.f, 0.f).Vector();
	return Forward * Input.Y + Right * Input.X;
}

void AEnderPlayerController::Move(const FInputActionValue& Value)
{
	AEnderPlayerCharacter* B = Binder();
	if (!B || !bGameplayInput) return;
	const FVector World = CameraRelative(Value.Get<FVector2D>()).GetClampedToMaxSize(1.f);
	B->SetMovementInput(World);
	B->AddMovementInput(World, 1.f);
}

void AEnderPlayerController::MoveStopped(const FInputActionValue&)
{
	if (AEnderPlayerCharacter* B = Binder()) B->SetMovementInput(FVector::ZeroVector);
}

void AEnderPlayerController::AimStick(const FInputActionValue& Value)
{
	AEnderPlayerCharacter* B = Binder();
	const FVector2D Stick = Value.Get<FVector2D>();
	if (!B || Stick.Size() < StickDeadzone) return;
	bStickAim = true;
	B->SetAimPoint(B->GetActorLocation() + CameraRelative(Stick).GetSafeNormal2D() * StickAimDistance);
}

void AEnderPlayerController::Skill(const FInputActionValue&, int32 Slot)
{
	if (!bGameplayInput) return;
	if (AEnderPlayerCharacter* B = Binder()) B->GetInputBuffer()->Press(Slot);
}

void AEnderPlayerController::Evade(const FInputActionValue&)
{
	if (!bGameplayInput) return;
	if (AEnderPlayerCharacter* B = Binder()) B->GetInputBuffer()->Press(6);
}

void AEnderPlayerController::Draught(const FInputActionValue&)
{
	if (!bGameplayInput) return;
	if (AEnderPlayerCharacter* B = Binder()) B->GetInputBuffer()->Press(7);
}

void AEnderPlayerController::Zoom(const FInputActionValue& Value)
{
	const float Axis = Value.Get<float>();
	if (AEnderPlayerCharacter* B = Binder(); B && !FMath::IsNearlyZero(Axis))
		B->GetCameraRig()->Zoom(Axis > 0.f ? -1 : 1); // wheel up zooms in
}

bool AEnderPlayerController::GetCursorGroundPoint(FVector& OutPoint) const
{
	const APawn* P = GetPawn();
	FVector Origin, Dir;
	if (!P || !DeprojectMousePositionToWorld(Origin, Dir) || FMath::IsNearlyZero(Dir.Z)) return false;
	const float FeetZ = P->GetActorLocation().Z - P->GetSimpleCollisionHalfHeight();
	const float T = (FeetZ - Origin.Z) / Dir.Z;
	if (T <= 0.f) return false;
	OutPoint = Origin + Dir * T;
	return true;
}

void AEnderPlayerController::SetGameplayInputEnabled(bool bEnabled)
{
	bGameplayInput = bEnabled;
	if (!bEnabled)
		if (AEnderPlayerCharacter* B = Binder()) B->GetInputBuffer()->ClearAll();
}

void AEnderPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);
	AEnderPlayerCharacter* B = Binder();
	if (!B) return;
	float MX = 0.f, MY = 0.f;
	if (GetMousePosition(MX, MY))
	{
		const FVector2D Mouse(MX, MY);
		if (!Mouse.Equals(LastMouse, 0.5f)) bStickAim = false; // the mouse moved: it owns aim again
		LastMouse = Mouse;
	}
	FVector Ground;
	// With mouse aim the point is re-projected every frame: the camera moves even when the mouse doesn't.
	if (!bStickAim && GetCursorGroundPoint(Ground)) B->SetAimPoint(Ground);
}
