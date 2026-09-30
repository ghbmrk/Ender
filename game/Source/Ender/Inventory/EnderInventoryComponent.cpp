#include "Inventory/EnderInventoryComponent.h"

#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystemComponent.h"
#include "AbilitySystemGlobals.h"
#include "Ender.h"
#include "GameFramework/Actor.h"
#include "Reality/EnderRealityClient.h"
#include "Reality/EnderRealityJson.h"
#include "Rules/LootRules.h"
#include "Save/EnderSaveGame.h"
#include "Save/EnderSaveSubsystem.h"
#include "Telemetry/EnderTelemetrySubsystem.h"
#include "TimerManager.h"

#define LOCTEXT_NAMESPACE "EnderInventory"

UEnderInventoryComponent::UEnderInventoryComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	SlotForms.SetNum(4);
}

UEnderInventoryComponent* UEnderInventoryComponent::FindFor(const AActor* Actor)
{
	return Actor ? Actor->FindComponentByClass<UEnderInventoryComponent>() : nullptr;
}

void UEnderInventoryComponent::BeginPlay()
{
	Super::BeginPlay();

	if (const UEnderSaveSubsystem* SaveSys = UEnderSaveSubsystem::Get(this))
	{
		LoadFrom(SaveSys->GetSave());
	}
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		BankedHandle = Client->OnArtifactsBanked.AddUObject(this, &ThisClass::HandleArtifactsBanked);
		Client->OnArtifactUpdated.AddDynamic(this, &ThisClass::HandleArtifactUpdated);
		Client->OnServiceAction.AddDynamic(this, &ThisClass::HandleServiceAction);
	}
	// Attribute bases are initialised by the owner during its own BeginPlay/possession; apply after that.
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().SetTimerForNextTick(FTimerDelegate::CreateUObject(this, &ThisClass::ReapplyGear));
	}
}

void UEnderInventoryComponent::EndPlay(const EEndPlayReason::Type Reason)
{
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		Client->OnArtifactsBanked.Remove(BankedHandle);
		Client->OnArtifactUpdated.RemoveDynamic(this, &ThisClass::HandleArtifactUpdated);
		Client->OnServiceAction.RemoveDynamic(this, &ThisClass::HandleServiceAction);
	}
	if (UEnderSaveSubsystem* SaveSys = UEnderSaveSubsystem::Get(this))
	{
		SaveTo(SaveSys->GetSave());
	}
	Super::EndPlay(Reason);
}

// ------------------------------------------------------------------ Forms

FGuid UEnderInventoryComponent::AddForm(FEnderForm Form)
{
	if (!Form.Id.IsValid())
	{
		Form.Id = FGuid::NewGuid();
	}
	if (Form.Qualities.Num() != EnderNumQualities)
	{
		Form.Qualities.SetNumZeroed(EnderNumQualities);
	}
	const FGuid Id = Form.Id;
	Forms.Add(MoveTemp(Form));
	Changed();
	return Id;
}

bool UEnderInventoryComponent::RemoveForm(const FGuid& FormId)
{
	for (int32 S = 0; S < SlotForms.Num(); ++S)
	{
		if (SlotForms[S] == FormId)
		{
			Unequip(static_cast<EEnderGearSlot>(S));
		}
	}
	const int32 Removed = Forms.RemoveAll([&FormId](const FEnderForm& F) { return F.Id == FormId; });
	if (Removed > 0)
	{
		Changed();
	}
	return Removed > 0;
}

bool UEnderInventoryComponent::GetForm(const FGuid& FormId, FEnderForm& OutForm) const
{
	const FEnderForm* F = Forms.FindByPredicate([&FormId](const FEnderForm& X) { return X.Id == FormId; });
	if (F)
	{
		OutForm = *F;
	}
	return F != nullptr;
}

FEnderForm* UEnderInventoryComponent::FindForm(const FGuid& FormId)
{
	return Forms.FindByPredicate([&FormId](const FEnderForm& X) { return X.Id == FormId; });
}

FEnderForm* UEnderInventoryComponent::FindFormByArtifact(const FString& ArtifactId)
{
	return ArtifactId.IsEmpty() ? nullptr : Forms.FindByPredicate([&ArtifactId](const FEnderForm& X) { return X.ArtifactId == ArtifactId; });
}

bool UEnderInventoryComponent::UpdateForm(const FEnderForm& Form)
{
	FEnderForm* Local = Form.Id.IsValid() ? FindForm(Form.Id) : FindFormByArtifact(Form.ArtifactId);
	if (!Local)
	{
		return false;
	}
	const FGuid Id = Local->Id;
	*Local = Form;
	Local->Id = Id;
	Changed();
	if (IsEquipped(Id))
	{
		ReapplyGear();
	}
	return true;
}

bool UEnderInventoryComponent::AttuneLocally(const FGuid& FormId, TArray<FText>& OutFamiliarLines)
{
	FEnderForm* Form = FindForm(FormId);
	if (!Form || Form->bOrdinary || Form->EvidenceTier != EEnderEvidenceTier::Veiled)
	{
		return false;
	}
	Form->EvidenceTier = EEnderEvidenceTier::Attuned;
	Form->RevealAll();
	++Form->Revision;

	// Familiar interpretation, at most two lines, from the qualities the Form already carries.
	int32 Strong = 0, Weak = 0;
	for (int32 Q = 1; Q < EnderNumQualities; ++Q)
	{
		if (Form->Qualities[Q] > Form->Qualities[Strong]) Strong = Q;
		if (Form->Qualities[Q] < Form->Qualities[Weak]) Weak = Q;
	}
	OutFamiliarLines.Reset();
	OutFamiliarLines.Add(FText::Format(LOCTEXT("AttuneLine1", "Its {0} runs deep; its {1} is thin."),
		EnderItems::QualityName(static_cast<EEnderQuality>(Strong)), EnderItems::QualityName(static_cast<EEnderQuality>(Weak))));
	OutFamiliarLines.Add(FText::Format(LOCTEXT("AttuneLine2", "Power {0} while only Attuned; a Trial would steady it."),
		FText::AsNumber(FMath::RoundToInt(Form->GetArtifactPower()))));
	Form->FamiliarLines = OutFamiliarLines;
	Changed();
	if (IsEquipped(FormId))
	{
		ReapplyGear();
	}
	return true;
}

// ------------------------------------------------------------------ Essences

void UEnderInventoryComponent::AddEssence(EEnderEssence Essence, int32 Quantity)
{
	if (Quantity <= 0)
	{
		return;
	}
	if (FEnderEssenceAmount* Stack = Essences.FindByPredicate([Essence](const FEnderEssenceAmount& A) { return A.Essence == Essence; }))
	{
		Stack->Quantity += Quantity;
	}
	else
	{
		Essences.Add({Essence, Quantity});
	}
	Changed();
}

bool UEnderInventoryComponent::SpendEssence(EEnderEssence Essence, int32 Quantity)
{
	FEnderEssenceAmount* Stack = Essences.FindByPredicate([Essence](const FEnderEssenceAmount& A) { return A.Essence == Essence; });
	if (!Stack || Stack->Quantity < Quantity)
	{
		return false;
	}
	Stack->Quantity -= Quantity;
	Changed();
	return true;
}

int32 UEnderInventoryComponent::GetEssence(EEnderEssence Essence) const
{
	const FEnderEssenceAmount* Stack = Essences.FindByPredicate([Essence](const FEnderEssenceAmount& A) { return A.Essence == Essence; });
	return Stack ? Stack->Quantity : 0;
}

void UEnderInventoryComponent::AddCrowns(int32 Amount)
{
	Crowns = FMath::Max(0, Crowns + Amount);
	Changed();
}

// ------------------------------------------------------------------ gear

bool UEnderInventoryComponent::Equip(const FGuid& FormId, EEnderGearSlot Slot)
{
	const FEnderForm* Form = FindForm(FormId);
	if (!Form)
	{
		return false;
	}
	if (Form->bOrdinary && Form->OrdinarySlot != Slot)
	{
		return false; // ordinary items fit their own slot only
	}
	// A Form occupies one slot at a time.
	for (int32 S = 0; S < SlotForms.Num(); ++S)
	{
		if (SlotForms[S] == FormId) SlotForms[S].Invalidate();
	}
	SlotForms[static_cast<int32>(Slot)] = FormId;
	ReapplyGear();
	Changed();
	OnEquipmentChanged.Broadcast(Slot, *Form);

	if (UEnderTelemetrySubsystem* Telemetry = UEnderTelemetrySubsystem::Get(this))
	{
		Telemetry->RecordFormEquipped(Form->CandidateId, Slot);
	}
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		if (!Form->bOrdinary && !Client->IsOffline())
		{
			if (Client->IsRealmActive())
			{
				const FString Body = FString::Printf(TEXT("{\"slot\":\"%s\",\"artifactId\":\"{artifact}\"}"), *EnderItems::SlotKey(Slot));
				Client->QueueDeferred(TEXT("POST"), TEXT("/api/equipment"), Body, FormId);
			}
			else if (!Form->ArtifactId.IsEmpty())
			{
				Client->Equip(Slot, Form->ArtifactId);
			}
		}
	}
	return true;
}

void UEnderInventoryComponent::Unequip(EEnderGearSlot Slot)
{
	FGuid& Held = SlotForms[static_cast<int32>(Slot)];
	if (!Held.IsValid())
	{
		return;
	}
	Held.Invalidate();
	ReapplyGear();
	Changed();
	OnEquipmentChanged.Broadcast(Slot, FEnderForm());
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		if (!Client->IsRealmActive() && !Client->IsOffline())
		{
			Client->Equip(Slot, FString());
		}
	}
}

bool UEnderInventoryComponent::GetEquipped(EEnderGearSlot Slot, FEnderForm& OutForm) const
{
	const FGuid& Id = SlotForms[static_cast<int32>(Slot)];
	return Id.IsValid() && GetForm(Id, OutForm);
}

bool UEnderInventoryComponent::IsEquipped(const FGuid& FormId) const
{
	return FormId.IsValid() && SlotForms.Contains(FormId);
}

float UEnderInventoryComponent::GetEquippedPower(EEnderGearSlot Slot) const
{
	FEnderForm Form;
	return GetEquipped(Slot, Form) ? Form.GetArtifactPower() : 0.f;
}

float UEnderInventoryComponent::GetLootPercentileBonus() const
{
	return static_cast<float>(EnderRules::Gear::CharmLootPercentileBonus(GetEquippedPower(EEnderGearSlot::Charm)));
}

UAbilitySystemComponent* UEnderInventoryComponent::GetOwnerASC() const
{
	return UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(GetOwner());
}

void UEnderInventoryComponent::ReapplyGear()
{
	ApplyGearDeltas();
}

void UEnderInventoryComponent::ApplyGearDeltas()
{
	UAbilitySystemComponent* ASC = GetOwnerASC();
	if (!ASC || !ASC->HasAttributeSetForAttribute(UEnderAttributeSet::GetAttackPowerAttribute()))
	{
		return;
	}
	if (AppliedTo.Get() != ASC)
	{
		// A new ability system (respawn / new pawn): its bases carry none of our earlier deltas.
		AppliedAttackPower = AppliedMaxHealth = AppliedCooldownReduction = 0.f;
		AppliedTo = ASC;
	}

	const float Blade = static_cast<float>(EnderRules::Gear::BladeDamageMultiplier(GetEquippedPower(EEnderGearSlot::Blade)) - 1.0);
	const float Ward = static_cast<float>(EnderRules::Gear::WardBonusHealth(GetEquippedPower(EEnderGearSlot::Ward)));
	const float Sigil = static_cast<float>(EnderRules::Gear::SigilCooldownReduction(GetEquippedPower(EEnderGearSlot::Sigil)));

	auto ApplyDelta = [ASC](const FGameplayAttribute& Attribute, float Target, float& Applied)
	{
		const float Delta = Target - Applied;
		if (!FMath::IsNearlyZero(Delta))
		{
			ASC->SetNumericAttributeBase(Attribute, ASC->GetNumericAttributeBase(Attribute) + Delta);
			Applied = Target;
		}
	};
	ApplyDelta(UEnderAttributeSet::GetAttackPowerAttribute(), Blade, AppliedAttackPower);
	ApplyDelta(UEnderAttributeSet::GetMaxHealthAttribute(), Ward, AppliedMaxHealth);
	ApplyDelta(UEnderAttributeSet::GetCooldownReductionAttribute(), Sigil, AppliedCooldownReduction);
}

// ------------------------------------------------------------------ service sync

void UEnderInventoryComponent::MergeServiceForm(FEnderForm& Local, const FEnderForm& Service) const
{
	const FGuid Id = Local.Id;
	const EEnderEvidenceTier LocalTier = Local.EvidenceTier;
	const int32 LocalMask = Local.RevealedQualityMask;
	const TArray<float> LocalQualities = Local.Qualities;
	const TArray<FText> LocalLines = Local.FamiliarLines;
	const float LocalTechnical = Local.TechnicalScore;

	Local = Service;
	Local.Id = Id;
	// Shrine attunement may not have reached the service yet; never regress what the player saw.
	if (static_cast<uint8>(LocalTier) > static_cast<uint8>(Local.EvidenceTier))
	{
		Local.EvidenceTier = LocalTier;
	}
	Local.RevealedQualityMask |= LocalMask;
	for (int32 Q = 0; Q < EnderNumQualities && Q < LocalQualities.Num(); ++Q)
	{
		if (!(Service.RevealedQualityMask & (1 << Q)) && Local.Qualities.IsValidIndex(Q))
		{
			Local.Qualities[Q] = LocalQualities[Q];
		}
	}
	if (Local.TechnicalScore <= 0.f)
	{
		Local.TechnicalScore = LocalTechnical;
	}
	if (Local.FamiliarLines.Num() == 0)
	{
		Local.FamiliarLines = LocalLines;
	}
}

void UEnderInventoryComponent::HandleArtifactsBanked(const TArray<FEnderForm>& Banked)
{
	for (const FEnderForm& Service : Banked)
	{
		FEnderForm* Local = FindFormByArtifact(Service.ArtifactId);
		if (!Local && !Service.CandidateId.IsEmpty())
		{
			Local = Forms.FindByPredicate([&Service](const FEnderForm& F) { return F.ArtifactId.IsEmpty() && F.CandidateId == Service.CandidateId; });
		}
		if (Local)
		{
			MergeServiceForm(*Local, Service);
		}
		else
		{
			FEnderForm Added = Service;
			Added.Id = FGuid::NewGuid();
			Forms.Add(Added);
		}
	}
	Changed();
	ReapplyGear();
	if (UEnderRealityClient* Client = UEnderRealityClient::Get(this))
	{
		if (!Client->IsRealmActive())
		{
			Client->ReplayDeferred([this](const FGuid& FormId)
			{
				const FEnderForm* F = FindForm(FormId);
				return F ? F->ArtifactId : FString();
			});
		}
	}
}

void UEnderInventoryComponent::HandleArtifactUpdated(const FEnderForm& Artifact, const TArray<FText>& FamiliarLines, const FEnderInferenceUsage& Usage)
{
	FEnderForm* Local = FindFormByArtifact(Artifact.ArtifactId);
	if (!Local)
	{
		return;
	}
	if (!Artifact.CandidateId.IsEmpty())
	{
		MergeServiceForm(*Local, Artifact);
	}
	if (FamiliarLines.Num() > 0)
	{
		Local->FamiliarLines = FamiliarLines.Num() > 2 ? TArray<FText>(FamiliarLines.GetData(), 2) : FamiliarLines;
	}
	Changed();
	ReapplyGear();
}

void UEnderInventoryComponent::HandleServiceAction(const FString& Action, bool bOk, const FString& Message)
{
	if (!bOk)
	{
		return;
	}
	FString Verb, ArtifactId;
	if (Action.Split(TEXT(":"), &Verb, &ArtifactId) && (Verb == TEXT("sell-form") || Verb == TEXT("fulfil")))
	{
		if (const FEnderForm* F = FindFormByArtifact(ArtifactId))
		{
			RemoveForm(F->Id);
		}
	}
}

// ------------------------------------------------------------------ save

void UEnderInventoryComponent::SaveTo(UEnderSaveGame* Save) const
{
	if (!Save)
	{
		return;
	}
	Save->Forms = Forms;
	Save->Essences = Essences;
	Save->Crowns = Crowns;
	Save->Equipped.Reset();
	for (int32 S = 0; S < SlotForms.Num(); ++S)
	{
		if (SlotForms[S].IsValid())
		{
			Save->Equipped.Add({static_cast<EEnderGearSlot>(S), SlotForms[S]});
		}
	}
}

void UEnderInventoryComponent::LoadFrom(const UEnderSaveGame* Save)
{
	if (!Save)
	{
		return;
	}
	Forms = Save->Forms;
	Essences = Save->Essences;
	Crowns = Save->Crowns;
	SlotForms.Init(FGuid(), 4);
	for (const FEnderEquippedEntry& E : Save->Equipped)
	{
		if (FindForm(E.FormId))
		{
			SlotForms[static_cast<int32>(E.Slot)] = E.FormId;
		}
	}
	bDirty = false;
	OnInventoryChanged.Broadcast();
}

void UEnderInventoryComponent::Persist()
{
	if (UEnderSaveSubsystem* SaveSys = UEnderSaveSubsystem::Get(this))
	{
		SaveTo(SaveSys->GetSave());
		SaveSys->SaveNow();
		bDirty = false;
	}
}

void UEnderInventoryComponent::Changed()
{
	bDirty = true;
	OnInventoryChanged.Broadcast();
	// Never serialise mid-fight; the Realm persists at room clear.
	const UEnderRealityClient* Client = UEnderRealityClient::Get(this);
	if (!Client || !Client->IsInCombat())
	{
		Persist();
	}
}

#undef LOCTEXT_NAMESPACE
