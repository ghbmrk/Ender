#include "UI/EnderMenuWidgets.h"

#include "Core/EnderGameInstance.h"
#include "Encounters/EnderRealmSubsystem.h"
#include "GameFramework/PlayerController.h"
#include "Inventory/EnderInventoryComponent.h"
#include "InputCoreTypes.h"
#include "Reality/EnderRealityClient.h"
#include "Telemetry/EnderTelemetrySubsystem.h"
#include "UI/EnderHUD.h"
#include "UI/EnderPalette.h"

#define LOCTEXT_NAMESPACE "EnderMenus"

// ---------------------------------------------------------------- base

void UEnderMenuWidget::Opened()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnServiceAction.AddUniqueDynamic(this, &ThisClass::HandleServiceAction);
	}
	NativeOpened();
	OnOpened();
}

void UEnderMenuWidget::Closed()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnServiceAction.RemoveDynamic(this, &ThisClass::HandleServiceAction);
	}
	NativeClosed();
	OnClosed();
}

void UEnderMenuWidget::CloseMenu()
{
	APlayerController* PC = GetOwningPlayer();
	if (AEnderHUD* HUD = PC ? PC->GetHUD<AEnderHUD>() : nullptr)
	{
		HUD->CloseMenus();
	}
}

void UEnderMenuWidget::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	SetIsFocusable(true);
}

FReply UEnderMenuWidget::NativeOnKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent)
{
	const FKey Key = InKeyEvent.GetKey();
	// Tab would otherwise be eaten by Slate focus navigation before Enhanced Input sees it.
	if (Key == EKeys::Escape || Key == EKeys::Tab || Key == EKeys::Gamepad_FaceButton_Right)
	{
		CloseMenu();
		return FReply::Handled();
	}
	return Super::NativeOnKeyDown(InGeometry, InKeyEvent);
}

void UEnderMenuWidget::HandleServiceAction(const FString& Action, bool bOk, const FString& Message)
{
	OnActionResult(Action, bOk, Message);
	Refresh();
}

// ---------------------------------------------------------------- inventory

void UEnderInventoryWidget::NativeOpened()
{
	if (UEnderInventoryComponent* Inv = GetInventory())
	{
		Inv->OnInventoryChanged.AddUniqueDynamic(this, &ThisClass::HandleInventoryChanged);
	}
	HandleInventoryChanged();
}

void UEnderInventoryWidget::NativeClosed()
{
	if (UEnderInventoryComponent* Inv = GetInventory())
	{
		Inv->OnInventoryChanged.RemoveDynamic(this, &ThisClass::HandleInventoryChanged);
	}
}

void UEnderInventoryWidget::HandleInventoryChanged()
{
	const UEnderInventoryComponent* Inv = GetInventory();
	OnInventoryRefreshed(Inv ? Inv->GetForms() : TArray<FEnderForm>(), Inv ? Inv->GetCrowns() : 0);
}

bool UEnderInventoryWidget::EquipForm(const FGuid& FormId, EEnderGearSlot Slot)
{
	UEnderInventoryComponent* Inv = GetInventory();
	if (!Inv || !Inv->Equip(FormId, Slot))
	{
		return false;
	}
	FEnderForm Form;
	if (Inv->GetForm(FormId, Form))
	{
		if (UEnderTelemetrySubsystem* T = UEnderTelemetrySubsystem::Get(this))
		{
			T->RecordFormEquipped(Form.CandidateId, Slot);
		}
	}
	return true;
}

void UEnderInventoryWidget::UnequipSlot(EEnderGearSlot Slot)
{
	if (UEnderInventoryComponent* Inv = GetInventory())
	{
		Inv->Unequip(Slot);
	}
}

void UEnderInventoryWidget::InspectForm(const FGuid& FormId)
{
	FEnderForm Form;
	const UEnderInventoryComponent* Inv = GetInventory();
	if (Inv && Inv->GetForm(FormId, Form))
	{
		if (UEnderTelemetrySubsystem* T = UEnderTelemetrySubsystem::Get(this))
		{
			T->RecordFormInspected(Form.CandidateId);
		}
	}
}

// ---------------------------------------------------------------- crucible

void UEnderCrucibleWidget::NativeOpened()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnTemperOptions.AddUniqueDynamic(this, &ThisClass::HandleTemperOptions);
		Client->OnCritique.AddUniqueDynamic(this, &ThisClass::HandleCritique);
		Client->OnArtifactUpdated.AddUniqueDynamic(this, &ThisClass::HandleArtifactUpdated);
	}
}

void UEnderCrucibleWidget::NativeClosed()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnTemperOptions.RemoveDynamic(this, &ThisClass::HandleTemperOptions);
		Client->OnCritique.RemoveDynamic(this, &ThisClass::HandleCritique);
		Client->OnArtifactUpdated.RemoveDynamic(this, &ThisClass::HandleArtifactUpdated);
	}
}

void UEnderCrucibleWidget::SelectForm(const FGuid& FormId)
{
	const UEnderInventoryComponent* Inv = GetInventory();
	if (Inv && Inv->GetForm(FormId, Selected))
	{
		OnFormSelected(Selected);
	}
}

bool UEnderCrucibleWidget::RequireArtifact()
{
	if (Selected.ArtifactId.IsEmpty())
	{
		OnUnavailable(Selected.bOrdinary
			? LOCTEXT("Ordinary", "Ordinary gear cannot be worked in the Crucible.")
			: LOCTEXT("NoArtifact", "This Form has not been recorded yet. Return when the Crossing is reachable."));
		return false;
	}
	const UEnderRealityClient* Client = GetRealityClient();
	if (!Client || Client->IsRealmActive())
	{
		OnUnavailable(LOCTEXT("InRealm", "The Crucible is cold while a Realm is open."));
		return false;
	}
	return true;
}

void UEnderCrucibleWidget::RequestTemper()
{
	if (RequireArtifact())
	{
		GetRealityClient()->RequestTemperOptions(Selected.ArtifactId);
	}
}

void UEnderCrucibleWidget::ChooseTemper(const FEnderTemperChoice& Choice)
{
	if (!RequireArtifact())
	{
		return;
	}
	if (UEnderTelemetrySubsystem* T = UEnderTelemetrySubsystem::Get(this))
	{
		T->RecordTemperSelection(Choice.Emphasis);
	}
	GetRealityClient()->ChooseTemper(Selected.ArtifactId, Choice.CandidateId);
}

void UEnderCrucibleWidget::RequestCritique(const FString& Mode)
{
	if (RequireArtifact())
	{
		GetRealityClient()->Critique(Selected.ArtifactId, Mode);
	}
}

void UEnderCrucibleWidget::RequestTrial(const FString& Mode)
{
	if (RequireArtifact())
	{
		GetRealityClient()->Evaluate(Selected.ArtifactId, Mode);
	}
}

void UEnderCrucibleWidget::HandleTemperOptions(const FString& ArtifactId, const TArray<FEnderTemperChoice>& Choices, const FText& Summary)
{
	if (ArtifactId == Selected.ArtifactId)
	{
		OnTemperOptions(Choices, Summary);
	}
}

void UEnderCrucibleWidget::HandleCritique(const FString& ArtifactId, const FEnderCritique& Critique)
{
	if (ArtifactId == Selected.ArtifactId)
	{
		OnCritique(Critique);
	}
}

void UEnderCrucibleWidget::HandleArtifactUpdated(const FEnderForm& Artifact, const TArray<FText>& FamiliarLines, const FEnderInferenceUsage& Usage)
{
	// A Temper yields a new revision (possibly a new artifact id); the Crucible follows it.
	UEnderInventoryComponent* Inv = GetInventory();
	const FEnderForm* Local = Inv ? Inv->FindFormByArtifact(Artifact.ArtifactId) : nullptr;
	Selected = Local ? *Local : Artifact;
	TArray<FText> Lines = FamiliarLines;
	if (Lines.Num() > EnderHudLayout::FamiliarMaxLines)
	{
		Lines.SetNum(EnderHudLayout::FamiliarMaxLines);
	}
	OnFormUpdated(Selected, Lines, Usage);
}

// ---------------------------------------------------------------- bazaar

void UEnderBazaarWidget::NativeOpened()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnBazaarUpdated.AddUniqueDynamic(this, &ThisClass::HandleBazaar);
		Client->OnContractsUpdated.AddUniqueDynamic(this, &ThisClass::HandleContracts);
		Client->RequestBazaar();
		Client->RequestContracts();
	}
}

void UEnderBazaarWidget::NativeClosed()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnBazaarUpdated.RemoveDynamic(this, &ThisClass::HandleBazaar);
		Client->OnContractsUpdated.RemoveDynamic(this, &ThisClass::HandleContracts);
	}
}

void UEnderBazaarWidget::HandleBazaar(const FEnderBazaarState& Bazaar)
{
	OnBazaarRefreshed(Bazaar);
}

void UEnderBazaarWidget::HandleContracts(const TArray<FEnderContract>& Contracts)
{
	OnContractsRefreshed(Contracts);
}

FString UEnderBazaarWidget::ArtifactIdFor(const FGuid& FormId) const
{
	FEnderForm Form;
	const UEnderInventoryComponent* Inv = GetInventory();
	return Inv && Inv->GetForm(FormId, Form) ? Form.ArtifactId : FString();
}

void UEnderBazaarWidget::BuyEssence(EEnderEssence Essence, int32 Quantity)
{
	if (UEnderRealityClient* Client = GetRealityClient()) Client->BuyEssence(Essence, Quantity);
}

void UEnderBazaarWidget::SellEssence(EEnderEssence Essence, int32 Quantity)
{
	if (UEnderRealityClient* Client = GetRealityClient()) Client->SellEssence(Essence, Quantity);
}

void UEnderBazaarWidget::BuyVeiledForm(const FString& OfferId)
{
	if (UEnderRealityClient* Client = GetRealityClient()) Client->BuyVeiledForm(OfferId);
}

void UEnderBazaarWidget::SellForm(const FGuid& FormId, bool bSalvage)
{
	const FString ArtifactId = ArtifactIdFor(FormId);
	if (ArtifactId.IsEmpty())
	{
		OnActionResult(TEXT("sell-form"), false, TEXT("This Form has not been recorded by the Crossing yet."));
		return;
	}
	if (UEnderRealityClient* Client = GetRealityClient()) Client->SellForm(ArtifactId, bSalvage);
}

void UEnderBazaarWidget::FulfilContract(const FString& ContractId, const FGuid& FormId)
{
	const FString ArtifactId = ArtifactIdFor(FormId);
	if (ArtifactId.IsEmpty())
	{
		OnActionResult(TEXT("fulfil"), false, TEXT("This Form has not been recorded by the Crossing yet."));
		return;
	}
	if (UEnderRealityClient* Client = GetRealityClient()) Client->FulfilContract(ContractId, ArtifactId);
}

void UEnderBazaarWidget::MakeProphecy(EEnderEssence Essence, int32 OptionIndex)
{
	if (UEnderRealityClient* Client = GetRealityClient()) Client->MakeProphecy(Essence, OptionIndex);
}

void UEnderBazaarWidget::ResolveProphecy(const FString& ProphecyId)
{
	if (UEnderRealityClient* Client = GetRealityClient()) Client->ResolveProphecy(ProphecyId);
}

TArray<int32> UEnderBazaarWidget::GetProphecyPercents()
{
	TArray<int32> Out;
	for (const float P : EnderEconomy::ProphecyOptions)
	{
		Out.Add(FMath::RoundToInt(P * 100.f));
	}
	return Out;
}

// ---------------------------------------------------------------- passives

void UEnderPassiveTreeWidget::NativeOpened()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnPassivesUpdated.AddUniqueDynamic(this, &ThisClass::HandlePassives);
		Client->RequestPassives();
	}
}

void UEnderPassiveTreeWidget::NativeClosed()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnPassivesUpdated.RemoveDynamic(this, &ThisClass::HandlePassives);
	}
}

void UEnderPassiveTreeWidget::HandlePassives(const FEnderPassiveTree& Tree)
{
	OnTreeRefreshed(Tree);
}

void UEnderPassiveTreeWidget::Allocate(const FString& NodeId)
{
	if (UEnderRealityClient* Client = GetRealityClient()) Client->AllocatePassive(NodeId);
}

// ---------------------------------------------------------------- realm gate

void UEnderRealmGateWidget::NativeOpened()
{
	bEntering = false;
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnRealmCardLoaded.AddUniqueDynamic(this, &ThisClass::HandleCard);
		for (const FString& Id : RealmIds)
		{
			Client->RequestRealmCard(Id);
		}
	}
}

void UEnderRealmGateWidget::NativeClosed()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnRealmCardLoaded.RemoveDynamic(this, &ThisClass::HandleCard);
	}
}

void UEnderRealmGateWidget::HandleCard(const FEnderRealmGateCard& Card)
{
	Cards.Add(Card.RealmId, Card);
	OnCardLoaded(Card);
}

bool UEnderRealmGateWidget::GetCard(const FString& RealmId, FEnderRealmGateCard& OutCard) const
{
	if (const FEnderRealmGateCard* Found = Cards.Find(RealmId))
	{
		OutCard = *Found;
		return true;
	}
	return false;
}

void UEnderRealmGateWidget::EnterRealm(const FString& RealmId)
{
	if (bEntering)
	{
		return;
	}
	UEnderGameInstance* GI = GetGameInstance<UEnderGameInstance>();
	if (!GI)
	{
		return;
	}
	bEntering = true;
	const FEnderRealmGateCard* Card = Cards.Find(RealmId);
	// "Economy-driven" when the chosen Realm carried the best contract bounty on offer.
	int32 BestOther = 0;
	for (const TPair<FString, FEnderRealmGateCard>& Pair : Cards)
	{
		if (Pair.Key != RealmId) BestOther = FMath::Max(BestOther, Pair.Value.BestBountyPct());
	}
	const bool bEconomyDriven = Card && Card->BestBountyPct() > 0 && Card->BestBountyPct() >= BestOther;
	OnEntering(RealmId);
	CloseMenu();
	GI->EnterRealm(RealmId, bEconomyDriven);
}

// ---------------------------------------------------------------- attunement

void UEnderAttunementWidget::NativeOpened()
{
	RevealElapsed = -1.f;
	bAwaitingService = false;
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnArtifactUpdated.AddUniqueDynamic(this, &ThisClass::HandleArtifactUpdated);
	}
}

void UEnderAttunementWidget::NativeClosed()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnArtifactUpdated.RemoveDynamic(this, &ThisClass::HandleArtifactUpdated);
	}
	bAwaitingService = false;
	RevealElapsed = -1.f;
}

void UEnderAttunementWidget::SelectForm(const FGuid& FormId)
{
	if (IsRevealing() || bAwaitingService)
	{
		return;
	}
	const UEnderInventoryComponent* Inv = GetInventory();
	if (Inv && Inv->GetForm(FormId, Selected))
	{
		OnFormSelected(Selected);
	}
}

bool UEnderAttunementWidget::Attune()
{
	if (IsRevealing() || bAwaitingService || !Selected.Id.IsValid())
	{
		return false;
	}
	UEnderInventoryComponent* Inv = GetInventory();
	if (!Inv)
	{
		return false;
	}
	MaskBefore = Selected.RevealedQualityMask;

	UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this);
	TArray<FText> Lines;
	if (Realm && Realm->IsRealmActive())
	{
		if (!Realm->AttuneAtShrine(GetBinder(), Selected.Id, Lines))
		{
			OnAttuneFailed(LOCTEXT("NoFocus", "The Shrine asks for Focus you do not have."));
			return false;
		}
	}
	else
	{
		UEnderRealityClient* Client = GetRealityClient();
		if (!Selected.ArtifactId.IsEmpty() && Client && Client->IsServiceReachable())
		{
			bAwaitingService = true;
			OnAttuning();
			Client->Attune(Selected.ArtifactId);
			return true;
		}
		if (!Inv->AttuneLocally(Selected.Id, Lines))
		{
			OnAttuneFailed(LOCTEXT("Nothing", "Nothing more can be read from this Form."));
			return false;
		}
	}
	FEnderForm After;
	Inv->GetForm(Selected.Id, After);
	BeginReveal(After, Lines);
	return true;
}

void UEnderAttunementWidget::HandleArtifactUpdated(const FEnderForm& Artifact, const TArray<FText>& FamiliarLines, const FEnderInferenceUsage& Usage)
{
	if (!bAwaitingService || Artifact.ArtifactId != Selected.ArtifactId)
	{
		return;
	}
	bAwaitingService = false;
	FEnderForm After = Artifact;
	if (UEnderInventoryComponent* Inv = GetInventory())
	{
		if (const FEnderForm* Local = Inv->FindFormByArtifact(Artifact.ArtifactId))
		{
			After = *Local;
		}
	}
	BeginReveal(After, FamiliarLines);
}

void UEnderAttunementWidget::BeginReveal(const FEnderForm& After, const TArray<FText>& Lines)
{
	Revealed = After;
	PendingLines = Lines;
	if (PendingLines.Num() > EnderHudLayout::FamiliarMaxLines)
	{
		PendingLines.SetNum(EnderHudLayout::FamiliarMaxLines);
	}
	NewlyRevealed.Reset();
	for (int32 q = 0; q < EnderNumQualities; ++q)
	{
		const int32 Bit = 1 << q;
		if ((After.RevealedQualityMask & Bit) && !(MaskBefore & Bit))
		{
			NewlyRevealed.Add(static_cast<EEnderQuality>(q));
		}
	}
	RevealElapsed = 0.f;
	OnRevealProgress(0.f, NewlyRevealed);
}

void UEnderAttunementWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	if (RevealElapsed < 0.f)
	{
		return;
	}
	RevealElapsed += InDeltaTime;
	const float Alpha = FMath::Clamp(RevealElapsed / EnderHudLayout::AttunementRevealSeconds, 0.f, 1.f);
	OnRevealProgress(Alpha, NewlyRevealed);
	if (Alpha >= 1.f)
	{
		RevealElapsed = -1.f;
		Selected = Revealed;
		OnQualitiesRevealed(Revealed, NewlyRevealed);
		OnFamiliarInterpretation(PendingLines);
	}
}

// ---------------------------------------------------------------- grimoire

void UEnderGrimoireWidget::NativeOpened()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnGrimoireLoaded.AddUniqueDynamic(this, &ThisClass::HandleGrimoire);
		Client->RequestGrimoire();
	}
}

void UEnderGrimoireWidget::NativeClosed()
{
	if (UEnderRealityClient* Client = GetRealityClient())
	{
		Client->OnGrimoireLoaded.RemoveDynamic(this, &ThisClass::HandleGrimoire);
	}
}

void UEnderGrimoireWidget::HandleGrimoire(const TArray<FEnderGrimoireEntry>& Entries)
{
	OnGrimoireRefreshed(Entries);
}

#undef LOCTEXT_NAMESPACE
