#pragma once

#include "CoreMinimal.h"
#include "Economy/EnderEconomyTypes.h"
#include "Items/EnderFormTypes.h"
#include "UI/EnderHUDWidgets.h"
#include "EnderMenuWidgets.generated.h"

/*
 * C++ bases for the Crossing menus (WBP_Inventory, WBP_Crucible, WBP_Bazaar,
 * WBP_PassiveTree, WBP_RealmGate, WBP_Attunement, WBP_Grimoire). AEnderHUD opens
 * them; while any is open gameplay input is off. Every service call goes through
 * UEnderRealityClient, which refuses requests while a Realm is active.
 */

UCLASS(Abstract)
class ENDER_API UEnderMenuWidget : public UEnderUserWidget
{
	GENERATED_BODY()

public:
	/** Called by AEnderHUD. */
	void Opened();
	void Closed();

	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void CloseMenu();

protected:
	virtual void NativeOpened() {}
	virtual void NativeClosed() {}
	virtual void NativeOnInitialized() override;
	virtual FReply NativeOnKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent) override;

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnOpened();
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnClosed();
	/** Any service action finished (buy, sell, fulfil, equip…); Message is for a toast. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnActionResult(const FString& Action, bool bOk, const FString& Message);

	UFUNCTION() void HandleServiceAction(const FString& Action, bool bOk, const FString& Message);
};

/** WBP_Inventory (Tab). */
UCLASS(Abstract)
class ENDER_API UEnderInventoryWidget : public UEnderMenuWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") bool EquipForm(const FGuid& FormId, EEnderGearSlot Slot);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void UnequipSlot(EEnderGearSlot Slot);
	/** Call when the player hovers or opens a Form's details. */
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void InspectForm(const FGuid& FormId);

protected:
	virtual void NativeOpened() override;
	virtual void NativeClosed() override;
	UFUNCTION() void HandleInventoryChanged();

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnInventoryRefreshed(const TArray<FEnderForm>& Forms, int32 Crowns);
};

/** WBP_Crucible: Temper, critique (Fracture / Mirror / Deep Trial) and trials. */
UCLASS(Abstract)
class ENDER_API UEnderCrucibleWidget : public UEnderMenuWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SelectForm(const FGuid& FormId);
	UFUNCTION(BlueprintPure, Category = "Ender|UI") FEnderForm GetSelectedForm() const { return Selected; }
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void RequestTemper();
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void ChooseTemper(const FEnderTemperChoice& Choice);
	/** Mode: fracture | mirror | deep */
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void RequestCritique(const FString& Mode);
	/** Mode: quick | full */
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void RequestTrial(const FString& Mode);

protected:
	virtual void NativeOpened() override;
	virtual void NativeClosed() override;

	UFUNCTION() void HandleTemperOptions(const FString& ArtifactId, const TArray<FEnderTemperChoice>& Choices, const FText& Summary);
	UFUNCTION() void HandleCritique(const FString& ArtifactId, const FEnderCritique& Critique);
	UFUNCTION() void HandleArtifactUpdated(const FEnderForm& Artifact, const TArray<FText>& FamiliarLines, const FEnderInferenceUsage& Usage);

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnFormSelected(const FEnderForm& Form);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnTemperOptions(const TArray<FEnderTemperChoice>& Choices, const FText& Summary);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnCritique(const FEnderCritique& Critique);
	/** A Temper or trial finished; Lines are the Familiar's reading (two lines at most). */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnFormUpdated(const FEnderForm& Form, const TArray<FText>& Lines, const FEnderInferenceUsage& Usage);
	/** The Form has no service artifact (offline find), so the Crucible cannot work it. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnUnavailable(const FText& Reason);

private:
	bool RequireArtifact();

	FEnderForm Selected;
};

/** WBP_Bazaar: essence trading, veiled Forms, contracts and prophecies. */
UCLASS(Abstract)
class ENDER_API UEnderBazaarWidget : public UEnderMenuWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void BuyEssence(EEnderEssence Essence, int32 Quantity);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SellEssence(EEnderEssence Essence, int32 Quantity);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void BuyVeiledForm(const FString& OfferId);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SellForm(const FGuid& FormId, bool bSalvage);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void FulfilContract(const FString& ContractId, const FGuid& FormId);
	/** OptionIndex 0–4 → 10 / 30 / 50 / 70 / 90 %. */
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void MakeProphecy(EEnderEssence Essence, int32 OptionIndex);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void ResolveProphecy(const FString& ProphecyId);
	UFUNCTION(BlueprintPure, Category = "Ender|UI") static TArray<int32> GetProphecyPercents();

protected:
	virtual void NativeOpened() override;
	virtual void NativeClosed() override;

	UFUNCTION() void HandleBazaar(const FEnderBazaarState& Bazaar);
	UFUNCTION() void HandleContracts(const TArray<FEnderContract>& Contracts);

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnBazaarRefreshed(const FEnderBazaarState& Bazaar);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnContractsRefreshed(const TArray<FEnderContract>& Contracts);

private:
	FString ArtifactIdFor(const FGuid& FormId) const;
};

/** WBP_PassiveTree. */
UCLASS(Abstract)
class ENDER_API UEnderPassiveTreeWidget : public UEnderMenuWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void Allocate(const FString& NodeId);

protected:
	virtual void NativeOpened() override;
	virtual void NativeClosed() override;
	UFUNCTION() void HandlePassives(const FEnderPassiveTree& Tree);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnTreeRefreshed(const FEnderPassiveTree& Tree);
};

/** WBP_RealmGate: one card per Realm; entering loads the Realm map. */
UCLASS(Abstract)
class ENDER_API UEnderRealmGateWidget : public UEnderMenuWidget
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|UI") TArray<FString> RealmIds = {TEXT("ashen-vault"), TEXT("glass-fen"), TEXT("hollow-keep")};

	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void EnterRealm(const FString& RealmId);
	UFUNCTION(BlueprintPure, Category = "Ender|UI") bool GetCard(const FString& RealmId, FEnderRealmGateCard& OutCard) const;

protected:
	virtual void NativeOpened() override;
	virtual void NativeClosed() override;
	UFUNCTION() void HandleCard(const FEnderRealmGateCard& Card);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnCardLoaded(const FEnderRealmGateCard& Card);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnEntering(const FString& RealmId);

private:
	UPROPERTY() TMap<FString, FEnderRealmGateCard> Cards;
	bool bEntering = false;
};

/**
 * WBP_Attunement: pick a Form, attune, a 0.8 s reveal of the newly read qualities,
 * then the Familiar's interpretation (two lines at most). Inside a Realm (the
 * Attunement Shrine) it attunes locally and spends 1 Focus; the service call is
 * replayed after the Realm.
 */
UCLASS(Abstract)
class ENDER_API UEnderAttunementWidget : public UEnderMenuWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SelectForm(const FGuid& FormId);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") bool Attune();
	UFUNCTION(BlueprintPure, Category = "Ender|UI") bool IsRevealing() const { return RevealElapsed >= 0.f; }

protected:
	virtual void NativeOpened() override;
	virtual void NativeClosed() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
	UFUNCTION() void HandleArtifactUpdated(const FEnderForm& Artifact, const TArray<FText>& FamiliarLines, const FEnderInferenceUsage& Usage);

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnFormSelected(const FEnderForm& Form);
	/** Waiting for the service. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnAttuning();
	/** 0 → 1 over 0.8 s. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnRevealProgress(float Alpha, const TArray<EEnderQuality>& NewlyRevealed);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnQualitiesRevealed(const FEnderForm& Form, const TArray<EEnderQuality>& NewlyRevealed);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnFamiliarInterpretation(const TArray<FText>& Lines);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnAttuneFailed(const FText& Reason);

private:
	void BeginReveal(const FEnderForm& After, const TArray<FText>& Lines);

	FEnderForm Selected;
	int32 MaskBefore = 0;
	bool bAwaitingService = false;
	float RevealElapsed = -1.f;
	FEnderForm Revealed;
	TArray<FText> PendingLines;
	TArray<EEnderQuality> NewlyRevealed;
};

/** WBP_Grimoire: every Form ever found. */
UCLASS(Abstract)
class ENDER_API UEnderGrimoireWidget : public UEnderMenuWidget
{
	GENERATED_BODY()

protected:
	virtual void NativeOpened() override;
	virtual void NativeClosed() override;
	UFUNCTION() void HandleGrimoire(const TArray<FEnderGrimoireEntry>& Entries);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnGrimoireRefreshed(const TArray<FEnderGrimoireEntry>& Entries);
};
