#pragma once

#include "Components/ActorComponent.h"
#include "CoreMinimal.h"
#include "Economy/EnderEconomyTypes.h"
#include "Items/EnderFormTypes.h"
#include "EnderInventoryComponent.generated.h"

class UAbilitySystemComponent;
class UEnderSaveGame;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FEnderOnInventoryChanged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FEnderOnEquipmentChanged, EEnderGearSlot, Slot, const FEnderForm&, Form);

/**
 * The Binder's Forms, Essences, Crowns and the four gear slots. Equipping applies
 * the gear formulas to the owner's ability system (Rules/LootRules.h Gear::*):
 *   Blade  AttackPower       += Power / 200        (1.0 base → 1 + P/200)
 *   Ward   MaxHealth         += Power × 1.5
 *   Sigil  CooldownReduction += min(25%, Power × 0.2%)
 *   Charm  loot percentile bonus Power × 0.10 (read by UEnderLootSubsystem)
 * Changes are applied as deltas on the attribute bases, so re-applying is idempotent.
 * Loads from and writes to UEnderSaveSubsystem; links local Forms to service
 * artifacts when the reality client reports them banked.
 */
UCLASS(ClassGroup = (Ender), meta = (BlueprintSpawnableComponent))
class ENDER_API UEnderInventoryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UEnderInventoryComponent();

	static UEnderInventoryComponent* FindFor(const AActor* Actor);

	// ------------------------------------------------------------ Forms

	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") FGuid AddForm(FEnderForm Form);
	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") bool RemoveForm(const FGuid& FormId);
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") bool GetForm(const FGuid& FormId, FEnderForm& OutForm) const;
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") TArray<FEnderForm> GetForms() const { return Forms; }
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") int32 NumForms() const { return Forms.Num(); }
	FEnderForm* FindForm(const FGuid& FormId);
	FEnderForm* FindFormByArtifact(const FString& ArtifactId);

	/** Replace a Form's data (after an Attune, Trial, Temper…), keeping its local id and slot. */
	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") bool UpdateForm(const FEnderForm& Form);

	/** Local reveal used by the Attunement Shrine inside a Realm (no network). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") bool AttuneLocally(const FGuid& FormId, TArray<FText>& OutFamiliarLines);

	// ------------------------------------------------------------ Essences / Crowns

	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") void AddEssence(EEnderEssence Essence, int32 Quantity);
	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") bool SpendEssence(EEnderEssence Essence, int32 Quantity);
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") int32 GetEssence(EEnderEssence Essence) const;
	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") void AddCrowns(int32 Amount);
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") int32 GetCrowns() const { return Crowns; }

	// ------------------------------------------------------------ gear

	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") bool Equip(const FGuid& FormId, EEnderGearSlot Slot);
	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") void Unequip(EEnderGearSlot Slot);
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") bool GetEquipped(EEnderGearSlot Slot, FEnderForm& OutForm) const;
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") bool IsEquipped(const FGuid& FormId) const;
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") float GetEquippedPower(EEnderGearSlot Slot) const;
	/** Charm: loot percentile bonus = Power × 0.10. */
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") float GetLootPercentileBonus() const;

	/**
	 * Re-applies gear to the ability system. Call after the owner initialises its
	 * attribute bases (the component also does this on BeginPlay and possession).
	 */
	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") void ReapplyGear();

	// ------------------------------------------------------------ save

	void SaveTo(UEnderSaveGame* Save) const;
	void LoadFrom(const UEnderSaveGame* Save);
	/** Writes into the save subsystem's slot and saves (async). */
	UFUNCTION(BlueprintCallable, Category = "Ender|Inventory") void Persist();
	UFUNCTION(BlueprintPure, Category = "Ender|Inventory") bool IsDirty() const { return bDirty; }

	UPROPERTY(BlueprintAssignable, Category = "Ender|Inventory") FEnderOnInventoryChanged OnInventoryChanged;
	UPROPERTY(BlueprintAssignable, Category = "Ender|Inventory") FEnderOnEquipmentChanged OnEquipmentChanged;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

private:
	UAbilitySystemComponent* GetOwnerASC() const;
	void ApplyGearDeltas();
	void HandleArtifactsBanked(const TArray<FEnderForm>& Banked);
	UFUNCTION() void HandleArtifactUpdated(const FEnderForm& Artifact, const TArray<FText>& FamiliarLines, const FEnderInferenceUsage& Usage);
	UFUNCTION() void HandleServiceAction(const FString& Action, bool bOk, const FString& Message);
	void MergeServiceForm(FEnderForm& Local, const FEnderForm& Service) const;
	void Changed();

	bool bDirty = false;

	UPROPERTY() TArray<FEnderForm> Forms;
	UPROPERTY() TArray<FEnderEssenceAmount> Essences;
	UPROPERTY() int32 Crowns = 0;
	/** Local Form id per gear slot (Blade, Ward, Sigil, Charm). */
	UPROPERTY() TArray<FGuid> SlotForms;

	/** What this component has added to each attribute base, so changes apply as deltas. */
	float AppliedAttackPower = 0.f;
	float AppliedMaxHealth = 0.f;
	float AppliedCooldownReduction = 0.f;
	TWeakObjectPtr<UAbilitySystemComponent> AppliedTo;
	FDelegateHandle BankedHandle;
};
