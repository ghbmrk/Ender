#include "Items/EnderLootDrop.h"

#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/WidgetComponent.h"
#include "Ender.h"
#include "GameFramework/Pawn.h"
#include "Inventory/EnderInventoryComponent.h"
#include "Items/EnderLootSubsystem.h"
#include "Telemetry/EnderTelemetrySubsystem.h"
#include "UI/EnderHUDWidgets.h"
#include "UI/EnderPalette.h"

#define LOCTEXT_NAMESPACE "EnderLoot"

AEnderLootDrop::AEnderLootDrop()
{
	PrimaryActorTick.bCanEverTick = false;

	PickupSphere = CreateDefaultSubobject<USphereComponent>(TEXT("PickupSphere"));
	PickupSphere->InitSphereRadius(60.f);
	PickupSphere->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	PickupSphere->SetGenerateOverlapEvents(false);
	RootComponent = PickupSphere;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	Mesh->SetupAttachment(PickupSphere);
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->SetRenderCustomDepth(true);
	Mesh->SetCustomDepthStencilValue(EnderStencil::Interactable);

	LabelWidget = CreateDefaultSubobject<UWidgetComponent>(TEXT("LabelWidget"));
	LabelWidget->SetupAttachment(PickupSphere);
	LabelWidget->SetWidgetSpace(EWidgetSpace::Screen);
	LabelWidget->SetDrawAtDesiredSize(true);
	LabelWidget->SetRelativeLocation(FVector(0.f, 0.f, 70.f));
	LabelWidget->SetVisibility(false);
}

void AEnderLootDrop::InitializeLoot(const FEnderLootPayload& InPayload)
{
	Payload = InPayload;
	Mesh->SetCustomDepthStencilValue(Payload.IsValuable() ? EnderStencil::ValuableLoot : EnderStencil::Interactable);
	if (UEnderLootLabelWidget* Label = Cast<UEnderLootLabelWidget>(LabelWidget->GetUserWidgetObject()))
	{
		Label->SetLoot(Payload);
	}
	OnPayloadSet();
}

void AEnderLootDrop::BeginPlay()
{
	Super::BeginPlay();
	if (UEnderLootSubsystem* Loot = GetWorld()->GetSubsystem<UEnderLootSubsystem>())
	{
		Loot->RegisterDrop(this);
		SetLabelVisible(Loot->AreLabelsVisible());
	}
	if (UEnderLootLabelWidget* Label = Cast<UEnderLootLabelWidget>(LabelWidget->GetUserWidgetObject()))
	{
		Label->SetLoot(Payload);
	}
	OnLootBeam(Payload.IsValuable(), EnderPalette::RarityColor(Payload.Rarity));
}

void AEnderLootDrop::EndPlay(const EEndPlayReason::Type Reason)
{
	if (UWorld* World = GetWorld())
	{
		if (UEnderLootSubsystem* Loot = World->GetSubsystem<UEnderLootSubsystem>())
		{
			Loot->UnregisterDrop(this);
		}
	}
	Super::EndPlay(Reason);
}

void AEnderLootDrop::SetLabelVisible(bool bVisible)
{
	LabelWidget->SetVisibility(bVisible);
}

bool AEnderLootDrop::CanInteract_Implementation(APawn* Instigator) const
{
	return !bPickedUp && UEnderInventoryComponent::FindFor(Instigator) != nullptr;
}

void AEnderLootDrop::Interact_Implementation(APawn* Instigator)
{
	UEnderInventoryComponent* Inventory = UEnderInventoryComponent::FindFor(Instigator);
	if (bPickedUp || !Inventory)
	{
		return;
	}
	bPickedUp = true;
	switch (Payload.Kind)
	{
	case EEnderLootKind::Form:
		Inventory->AddForm(Payload.Form);
		break;
	case EEnderLootKind::Essence:
		Inventory->AddEssence(Payload.Essence.Essence, Payload.Essence.Quantity);
		break;
	case EEnderLootKind::Crowns:
		Inventory->AddCrowns(Payload.Crowns);
		break;
	}
	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		Telemetry->RecordLootPickedUp(Payload.Kind);
	}
	OnPickedUp(Instigator);
	SetLifeSpan(0.05f);
	SetActorHiddenInGame(true);
}

FText AEnderLootDrop::GetInteractPrompt_Implementation() const
{
	return FText::Format(LOCTEXT("PickUp", "Take {0}"), Payload.GetLabel());
}

#undef LOCTEXT_NAMESPACE
