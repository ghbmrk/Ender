#include "Encounters/EnderRealmInteractable.h"

#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Encounters/EnderRealmSubsystem.h"
#include "Ender.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "UI/EnderHUD.h"

#define LOCTEXT_NAMESPACE "EnderRealm"

AEnderRealmInteractable::AEnderRealmInteractable()
{
	PrimaryActorTick.bCanEverTick = false;
	UseSphere = CreateDefaultSubobject<USphereComponent>(TEXT("UseSphere"));
	UseSphere->InitSphereRadius(120.f);
	UseSphere->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	RootComponent = UseSphere;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	Mesh->SetupAttachment(UseSphere);
	Mesh->SetRenderCustomDepth(true);
	Mesh->SetCustomDepthStencilValue(EnderStencil::Interactable);
}

bool AEnderRealmInteractable::CanInteract_Implementation(APawn* Instigator) const
{
	const UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this);
	switch (Interaction)
	{
	case EEnderRealmInteraction::AttunementShrine:
		return !Realm || !Realm->IsRealmActive() || Realm->GetSegment() == EEnderRealmSegment::AttunementShrine;
	case EEnderRealmInteraction::RewardAltar:
	case EEnderRealmInteraction::ReturnPortal:
		return Realm && Realm->IsRealmActive() && Realm->CanEnterSegment(Interaction == EEnderRealmInteraction::RewardAltar
			? EEnderRealmSegment::RewardAltar : EEnderRealmSegment::ReturnPortal) && Realm->GetSegment() != EEnderRealmSegment::Boss;
	default:
		return !Realm || !Realm->IsRealmActive();
	}
}

void AEnderRealmInteractable::Interact_Implementation(APawn* Instigator)
{
	UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this);
	const APlayerController* PC = Instigator ? Cast<APlayerController>(Instigator->GetController()) : nullptr;
	AEnderHUD* HUD = PC ? PC->GetHUD<AEnderHUD>() : nullptr;
	switch (Interaction)
	{
	case EEnderRealmInteraction::AttunementShrine:
		if (HUD) HUD->OpenMenu(EEnderMenu::Attunement);
		break;
	case EEnderRealmInteraction::RewardAltar:
		if (Realm) Realm->ClaimRewardAltar();
		break;
	case EEnderRealmInteraction::ReturnPortal:
		if (Realm) Realm->UseReturnPortal();
		break;
	case EEnderRealmInteraction::RealmGate:
		if (HUD) HUD->OpenMenu(EEnderMenu::RealmGate);
		break;
	case EEnderRealmInteraction::Bazaar:
		if (HUD) HUD->OpenMenu(EEnderMenu::Bazaar);
		break;
	case EEnderRealmInteraction::Crucible:
		if (HUD) HUD->OpenMenu(EEnderMenu::Crucible);
		break;
	case EEnderRealmInteraction::Grimoire:
		if (HUD) HUD->OpenMenu(EEnderMenu::Grimoire);
		break;
	case EEnderRealmInteraction::PassiveTree:
		if (HUD) HUD->OpenMenu(EEnderMenu::PassiveTree);
		break;
	}
	OnUsed(Instigator);
}

FText AEnderRealmInteractable::GetInteractPrompt_Implementation() const
{
	switch (Interaction)
	{
	case EEnderRealmInteraction::AttunementShrine: return LOCTEXT("Shrine", "Attune");
	case EEnderRealmInteraction::RewardAltar: return LOCTEXT("Altar", "Claim the Realm's reward");
	case EEnderRealmInteraction::ReturnPortal: return LOCTEXT("Portal", "Return to the Crossing");
	case EEnderRealmInteraction::RealmGate: return LOCTEXT("Gate", "Choose a Realm");
	case EEnderRealmInteraction::Bazaar: return LOCTEXT("Bazaar", "Trade at the Bazaar");
	case EEnderRealmInteraction::Crucible: return LOCTEXT("Crucible", "Work the Crucible");
	case EEnderRealmInteraction::Grimoire: return LOCTEXT("Grimoire", "Read the Grimoire");
	case EEnderRealmInteraction::PassiveTree: return LOCTEXT("Passives", "Study the passive tree");
	}
	return FText::GetEmpty();
}

#undef LOCTEXT_NAMESPACE
