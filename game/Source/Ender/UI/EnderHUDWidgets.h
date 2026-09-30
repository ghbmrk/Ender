#pragma once

#include "Blueprint/UserWidget.h"
#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "Items/EnderFormTypes.h"
#include "UI/EnderDamageNumberQueue.h"
#include "EnderHUDWidgets.generated.h"

class AEnderCharacterBase;
class UCanvasPanel;
class UEnderAbilitySystemComponent;
class UEnderInventoryComponent;
class UEnderRealityClient;
class UImage;
class UProgressBar;
class UTextBlock;

/*
 * C++ bases for the in-combat HUD widgets (WBP_* in Content/UI derive from these).
 * Every bound child is optional (BindWidgetOptional) so a WBP can restyle freely;
 * each class also exposes a BlueprintImplementableEvent refresh hook. Layout at
 * 1080p: skill bar bottom-centre (six 58×58 icons, 7 px gap; Evade 46×46), health
 * bottom-left with Thread directly below, minimap top-left 180×180, pinned
 * contract top-right (two lines max). There is no chat composer.
 */

UCLASS(Abstract)
class ENDER_API UEnderUserWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	/** Re-reads data and calls OnRefresh. */
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void Refresh();

protected:
	virtual void NativeRefresh() {}

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnRefresh();

	UFUNCTION(BlueprintPure, Category = "Ender|UI") APawn* GetBinder() const;
	UEnderAbilitySystemComponent* GetBinderASC() const;
	UFUNCTION(BlueprintPure, Category = "Ender|UI") UEnderInventoryComponent* GetInventory() const;
	UFUNCTION(BlueprintPure, Category = "Ender|UI") UEnderRealityClient* GetRealityClient() const;
};

/** WBP_SkillBar: cooldowns for skills 1–6 and Evade. */
UCLASS(Abstract)
class ENDER_API UEnderSkillBarWidget : public UEnderUserWidget
{
	GENERATED_BODY()

public:
	/** Top-left of slot 0–5 within the bar, and Evade's, in 1080p units. */
	UFUNCTION(BlueprintPure, Category = "Ender|UI") static FVector2D GetSlotPosition(int32 Slot);
	UFUNCTION(BlueprintPure, Category = "Ender|UI") static FVector2D GetEvadePosition();

	/** Cooldown tag per skill slot (1–6); empty tags have no cooldown (Thread Lash, Sever). Defaults set in NativeConstruct. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ender|UI") TArray<FGameplayTag> SlotCooldownTags;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ender|UI") FGameplayTag EvadeCooldownTag;

protected:
	virtual void NativeConstruct() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

	/** Seconds left per slot (6 entries) and for Evade. Fired each frame while anything is cooling. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnCooldowns(const TArray<float>& Remaining, float EvadeRemaining);

private:
	bool bWasCooling = true;
};

/** WBP_Health (bottom-left). */
UCLASS(Abstract)
class ENDER_API UEnderHealthWidget : public UEnderUserWidget
{
	GENERATED_BODY()

protected:
	virtual void NativeConstruct() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnHealthChanged(float Health, float MaxHealth, float Barrier);

	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UProgressBar> HealthBar;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UProgressBar> BarrierBar;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UTextBlock> HealthText;

private:
	float LastHealth = -1.f, LastMax = -1.f, LastBarrier = -1.f;
};

/** WBP_Thread (directly below health). */
UCLASS(Abstract)
class ENDER_API UEnderThreadWidget : public UEnderUserWidget
{
	GENERATED_BODY()

protected:
	virtual void NativeConstruct() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnThreadChanged(float Thread, float MaxThread);

	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UProgressBar> ThreadBar;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UTextBlock> ThreadText;

private:
	float LastThread = -1.f, LastMax = -1.f;
};

/** WBP_Draughts: charges live on the Binder. */
UCLASS(Abstract)
class ENDER_API UEnderDraughtsWidget : public UEnderUserWidget
{
	GENERATED_BODY()

protected:
	virtual void NativeConstruct() override;
	virtual void NativeDestruct() override;
	UFUNCTION() void HandleDraughtsChanged(int32 Charges, int32 MaxCharges);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnDraughtsChanged(int32 Charges, int32 MaxCharges);

	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UTextBlock> ChargesText;
};

/** WBP_EnemyHealth: over an elite or the targeted enemy. */
UCLASS(Abstract)
class ENDER_API UEnderEnemyHealthWidget : public UEnderUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SetEnemy(AEnderCharacterBase* InEnemy, bool bElite);

protected:
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnEnemySet(AEnderCharacterBase* InEnemy, bool bElite);

	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UProgressBar> HealthBar;
	TWeakObjectPtr<AEnderCharacterBase> Enemy;
};

/** WBP_BossHealth: the Bound King's bar, name, phase and stagger. */
UCLASS(Abstract)
class ENDER_API UEnderBossHealthWidget : public UEnderUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SetBoss(AEnderCharacterBase* InBoss, FText Name);

protected:
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnBossSet(AEnderCharacterBase* InBoss);

	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UProgressBar> HealthBar;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UProgressBar> StaggerBar;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UTextBlock> NameText;
	TWeakObjectPtr<AEnderCharacterBase> Boss;
};

/** WBP_LootLabel: shown over drops while Alt is held. */
UCLASS(Abstract)
class ENDER_API UEnderLootLabelWidget : public UEnderUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void SetLoot(const FEnderLootPayload& InPayload);
	UFUNCTION(BlueprintPure, Category = "Ender|UI") FEnderLootPayload GetLoot() const { return Payload; }

protected:
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnLootSet(const FEnderLootPayload& InPayload, FLinearColor RarityColor);

	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UTextBlock> LabelText;
	FEnderLootPayload Payload;
};

/**
 * WBP_HUD: composes the widgets above, draws damage numbers into DamageNumberLayer,
 * shows the pinned contract and the interact prompt.
 */
UCLASS(Abstract)
class ENDER_API UEnderHUDWidget : public UEnderUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void ShowBoss(AEnderCharacterBase* Boss, FText Name);
	UFUNCTION(BlueprintCallable, Category = "Ender|UI") void HideBoss();
	/** M inside a Realm: the Blueprint expands the minimap into the Realm map. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnToggleMap();

protected:
	virtual void NativeConstruct() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnInteractPrompt(const FText& Prompt, bool bVisible);
	UFUNCTION(BlueprintImplementableEvent, Category = "Ender|UI") void OnPinnedContract(const FText& Label);

	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UEnderSkillBarWidget> SkillBar;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UEnderHealthWidget> Health;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UEnderThreadWidget> Thread;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UEnderDraughtsWidget> Draughts;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UEnderBossHealthWidget> BossHealth;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UImage> Minimap;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UTextBlock> PinnedContractText;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UTextBlock> InteractPromptText;
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UTextBlock> FocusText;
	/** Full-screen canvas the damage numbers are drawn on. */
	UPROPERTY(meta = (BindWidgetOptional)) TObjectPtr<UCanvasPanel> DamageNumberLayer;

	/** Fonts: Alegreya SC for numbers (set in the WBP defaults). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|UI") FSlateFontInfo DamageNumberFont;
	/** How far a number rises over its 0.65 s life, in 1080p units. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|UI") float DamageNumberRise = 42.f;

private:
	void DrawDamageNumbers();
	void UpdatePrompt(float DeltaSeconds);
	void UpdatePinnedContract();

	UPROPERTY() TArray<TObjectPtr<UTextBlock>> NumberPool;
	float PromptTimer = 0.f;
	FString LastContractLabel;
};
