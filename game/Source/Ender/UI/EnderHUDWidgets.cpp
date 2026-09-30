#include "UI/EnderHUDWidgets.h"

#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Blueprint/WidgetLayoutLibrary.h"
#include "Character/EnderCharacterBase.h"
#include "Character/EnderPlayerCharacter.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/Image.h"
#include "Components/ProgressBar.h"
#include "Components/TextBlock.h"
#include "Encounters/EnderRealmSubsystem.h"
#include "GameFramework/PlayerController.h"
#include "Inventory/EnderInventoryComponent.h"
#include "Items/EnderInteractable.h"
#include "Reality/EnderRealityClient.h"
#include "UI/EnderPalette.h"

#define LOCTEXT_NAMESPACE "EnderHUD"

// ---------------------------------------------------------------- base

void UEnderUserWidget::Refresh()
{
	NativeRefresh();
	OnRefresh();
}

APawn* UEnderUserWidget::GetBinder() const
{
	const APlayerController* PC = GetOwningPlayer();
	return PC ? PC->GetPawn() : nullptr;
}

UEnderAbilitySystemComponent* UEnderUserWidget::GetBinderASC() const
{
	const AEnderCharacterBase* Binder = Cast<AEnderCharacterBase>(GetBinder());
	return Binder ? Binder->GetEnderASC() : nullptr;
}

UEnderInventoryComponent* UEnderUserWidget::GetInventory() const
{
	return UEnderInventoryComponent::FindFor(GetBinder());
}

UEnderRealityClient* UEnderUserWidget::GetRealityClient() const
{
	return UEnderRealityClient::Get(this);
}

// ---------------------------------------------------------------- skill bar

FVector2D UEnderSkillBarWidget::GetSlotPosition(int32 Slot)
{
	const int32 Clamped = FMath::Clamp(Slot, 0, EnderHudLayout::SkillCount - 1);
	return FVector2D(Clamped * (EnderHudLayout::SkillIconSize + EnderHudLayout::SkillIconGap), 0.f);
}

FVector2D UEnderSkillBarWidget::GetEvadePosition()
{
	// Right of the six skills, bottom-aligned with them.
	return FVector2D(EnderHudLayout::SkillBarWidth() + EnderHudLayout::SkillIconGap * 2.f,
		EnderHudLayout::SkillIconSize - EnderHudLayout::EvadeIconSize);
}

void UEnderSkillBarWidget::NativeConstruct()
{
	Super::NativeConstruct();
	if (SlotCooldownTags.Num() == 0)
	{
		SlotCooldownTags = {
			FGameplayTag(), // Thread Lash
			FGameplayTag(), // Sever (Thread cost only)
			EnderTags::Cooldown_Bind,
			EnderTags::Cooldown_Unravel,
			EnderTags::Cooldown_WardingSigil,
			EnderTags::Cooldown_GrandFracture,
		};
	}
	if (!EvadeCooldownTag.IsValid())
	{
		EvadeCooldownTag = EnderTags::Cooldown_Evade;
	}
	bWasCooling = true;
}

void UEnderSkillBarWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	const UEnderAbilitySystemComponent* ASC = GetBinderASC();
	if (!ASC)
	{
		return;
	}
	TArray<float> Remaining;
	Remaining.SetNumZeroed(EnderHudLayout::SkillCount);
	bool bCooling = false;
	for (int32 i = 0; i < EnderHudLayout::SkillCount && i < SlotCooldownTags.Num(); ++i)
	{
		if (SlotCooldownTags[i].IsValid())
		{
			Remaining[i] = ASC->GetCooldownRemaining(SlotCooldownTags[i]);
			bCooling |= Remaining[i] > 0.f;
		}
	}
	const float Evade = EvadeCooldownTag.IsValid() ? ASC->GetCooldownRemaining(EvadeCooldownTag) : 0.f;
	bCooling |= Evade > 0.f;
	// One extra event after everything finishes so the Blueprint can clear its overlays.
	if (bCooling || bWasCooling)
	{
		OnCooldowns(Remaining, Evade);
	}
	bWasCooling = bCooling;
}

// ---------------------------------------------------------------- health / thread

void UEnderHealthWidget::NativeConstruct()
{
	Super::NativeConstruct();
	if (HealthBar) HealthBar->SetFillColorAndOpacity(EnderPalette::Health());
	LastHealth = LastMax = LastBarrier = -1.f;
}

void UEnderHealthWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	const AEnderCharacterBase* Binder = Cast<AEnderCharacterBase>(GetBinder());
	const UEnderAttributeSet* A = Binder ? Binder->GetAttributes() : nullptr;
	if (!A)
	{
		return;
	}
	const float H = A->GetHealth(), M = A->GetMaxHealth(), B = A->GetBarrier();
	if (FMath::IsNearlyEqual(H, LastHealth) && FMath::IsNearlyEqual(M, LastMax) && FMath::IsNearlyEqual(B, LastBarrier))
	{
		return;
	}
	LastHealth = H; LastMax = M; LastBarrier = B;
	const float SafeMax = FMath::Max(1.f, M);
	if (HealthBar) HealthBar->SetPercent(H / SafeMax);
	if (BarrierBar) BarrierBar->SetPercent(FMath::Clamp(B / SafeMax, 0.f, 1.f));
	if (HealthText) HealthText->SetText(FText::Format(LOCTEXT("HealthFmt", "{0} / {1}"), FText::AsNumber(FMath::CeilToInt(H)), FText::AsNumber(FMath::RoundToInt(M))));
	OnHealthChanged(H, M, B);
}

void UEnderThreadWidget::NativeConstruct()
{
	Super::NativeConstruct();
	if (ThreadBar) ThreadBar->SetFillColorAndOpacity(EnderPalette::PlayerThread());
	LastThread = LastMax = -1.f;
}

void UEnderThreadWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	const AEnderCharacterBase* Binder = Cast<AEnderCharacterBase>(GetBinder());
	const UEnderAttributeSet* A = Binder ? Binder->GetAttributes() : nullptr;
	if (!A)
	{
		return;
	}
	const float T = A->GetThread(), M = A->GetMaxThread();
	if (FMath::IsNearlyEqual(T, LastThread) && FMath::IsNearlyEqual(M, LastMax))
	{
		return;
	}
	LastThread = T; LastMax = M;
	if (ThreadBar) ThreadBar->SetPercent(T / FMath::Max(1.f, M));
	if (ThreadText) ThreadText->SetText(FText::AsNumber(FMath::FloorToInt(T)));
	OnThreadChanged(T, M);
}

// ---------------------------------------------------------------- draughts

void UEnderDraughtsWidget::NativeConstruct()
{
	Super::NativeConstruct();
	if (AEnderPlayerCharacter* Binder = Cast<AEnderPlayerCharacter>(GetBinder()))
	{
		Binder->OnDraughtsChanged.AddUniqueDynamic(this, &ThisClass::HandleDraughtsChanged);
		HandleDraughtsChanged(Binder->GetDraughtCharges(), Binder->GetMaxDraughtCharges());
	}
}

void UEnderDraughtsWidget::NativeDestruct()
{
	if (AEnderPlayerCharacter* Binder = Cast<AEnderPlayerCharacter>(GetBinder()))
	{
		Binder->OnDraughtsChanged.RemoveDynamic(this, &ThisClass::HandleDraughtsChanged);
	}
	Super::NativeDestruct();
}

void UEnderDraughtsWidget::HandleDraughtsChanged(int32 Charges, int32 MaxCharges)
{
	if (ChargesText)
	{
		ChargesText->SetText(FText::AsNumber(Charges));
	}
	OnDraughtsChanged(Charges, MaxCharges);
}

// ---------------------------------------------------------------- enemy / boss

void UEnderEnemyHealthWidget::SetEnemy(AEnderCharacterBase* InEnemy, bool bElite)
{
	Enemy = InEnemy;
	if (HealthBar) HealthBar->SetFillColorAndOpacity(bElite ? EnderPalette::Danger() : EnderPalette::Health());
	OnEnemySet(InEnemy, bElite);
}

void UEnderEnemyHealthWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	const AEnderCharacterBase* E = Enemy.Get();
	const UEnderAttributeSet* A = E ? E->GetAttributes() : nullptr;
	if (HealthBar && A)
	{
		HealthBar->SetPercent(A->GetHealth() / FMath::Max(1.f, A->GetMaxHealth()));
	}
}

void UEnderBossHealthWidget::SetBoss(AEnderCharacterBase* InBoss, FText Name)
{
	Boss = InBoss;
	if (NameText) NameText->SetText(Name);
	if (HealthBar) HealthBar->SetFillColorAndOpacity(EnderPalette::Danger());
	if (StaggerBar) StaggerBar->SetFillColorAndOpacity(EnderPalette::Ochre());
	OnBossSet(InBoss);
}

void UEnderBossHealthWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	const AEnderCharacterBase* B = Boss.Get();
	const UEnderAttributeSet* A = B ? B->GetAttributes() : nullptr;
	if (!A)
	{
		return;
	}
	if (HealthBar) HealthBar->SetPercent(A->GetHealth() / FMath::Max(1.f, A->GetMaxHealth()));
	if (StaggerBar) StaggerBar->SetPercent(A->GetStagger() / FMath::Max(1.f, A->GetMaxStagger()));
}

// ---------------------------------------------------------------- loot label

void UEnderLootLabelWidget::SetLoot(const FEnderLootPayload& InPayload)
{
	Payload = InPayload;
	const FLinearColor Color = EnderPalette::RarityColor(Payload.Rarity);
	if (LabelText)
	{
		LabelText->SetText(Payload.GetLabel());
		LabelText->SetColorAndOpacity(FSlateColor(Color));
	}
	OnLootSet(Payload, Color);
}

// ---------------------------------------------------------------- HUD

void UEnderHUDWidget::NativeConstruct()
{
	Super::NativeConstruct();
	if (BossHealth) BossHealth->SetVisibility(ESlateVisibility::Collapsed);
	if (InteractPromptText) InteractPromptText->SetVisibility(ESlateVisibility::Collapsed);
	if (DamageNumberLayer) DamageNumberLayer->SetVisibility(ESlateVisibility::HitTestInvisible);
	LastContractLabel.Reset();
	UpdatePinnedContract();
}

void UEnderHUDWidget::ShowBoss(AEnderCharacterBase* Boss, FText Name)
{
	if (BossHealth)
	{
		BossHealth->SetBoss(Boss, Name);
		BossHealth->SetVisibility(ESlateVisibility::HitTestInvisible);
	}
}

void UEnderHUDWidget::HideBoss()
{
	if (BossHealth)
	{
		BossHealth->SetBoss(nullptr, FText::GetEmpty());
		BossHealth->SetVisibility(ESlateVisibility::Collapsed);
	}
}

void UEnderHUDWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
	DrawDamageNumbers();
	UpdatePrompt(InDeltaTime);
	if (FocusText)
	{
		const UEnderRealmSubsystem* Realm = UEnderRealmSubsystem::Get(this);
		if (Realm && Realm->IsRealmActive())
		{
			FocusText->SetText(FText::Format(LOCTEXT("FocusFmt", "Focus {0}/{1}"), FText::AsNumber(Realm->GetFocus()), FText::AsNumber(Realm->GetMaxFocus())));
			FocusText->SetVisibility(ESlateVisibility::HitTestInvisible);
		}
		else
		{
			FocusText->SetVisibility(ESlateVisibility::Collapsed);
		}
	}
}

void UEnderHUDWidget::DrawDamageNumbers()
{
	if (!DamageNumberLayer)
	{
		return;
	}
	const UEnderDamageNumberQueue* Queue = UEnderDamageNumberQueue::Get(this);
	APlayerController* PC = GetOwningPlayer();
	const TArray<FEnderDamageNumber> Numbers = Queue ? Queue->GetLiveNumbers() : TArray<FEnderDamageNumber>();

	while (NumberPool.Num() < Numbers.Num())
	{
		UTextBlock* Text = NewObject<UTextBlock>(this);
		Text->SetJustification(ETextJustify::Center);
		UCanvasPanelSlot* CanvasSlot = DamageNumberLayer->AddChildToCanvas(Text);
		if (CanvasSlot)
		{
			CanvasSlot->SetAutoSize(true);
			CanvasSlot->SetAlignment(FVector2D(0.5f, 0.5f));
		}
		NumberPool.Add(Text);
	}

	for (int32 i = 0; i < NumberPool.Num(); ++i)
	{
		UTextBlock* Text = NumberPool[i];
		if (!Text)
		{
			continue;
		}
		FVector2D ScreenPos;
		const bool bShow = PC && Numbers.IsValidIndex(i)
			&& UWidgetLayoutLibrary::ProjectWorldLocationToWidgetPosition(PC, Numbers[i].WorldLocation, ScreenPos, false);
		if (!bShow)
		{
			Text->SetVisibility(ESlateVisibility::Collapsed);
			continue;
		}
		const FEnderDamageNumber& N = Numbers[i];
		const float Life = FMath::Clamp(N.Life, 0.f, 1.f);
		ScreenPos.Y -= DamageNumberRise * Life;

		FSlateFontInfo Font = DamageNumberFont;
		Font.Size = N.FontSize;
		Text->SetFont(Font);
		const FString Label = N.Hits > 1
			? FString::Printf(TEXT("%d ×%d"), FMath::RoundToInt(N.Amount), N.Hits)
			: FString::FromInt(FMath::RoundToInt(N.Amount));
		Text->SetText(FText::FromString(Label));
		FLinearColor Color = N.Color;
		Color.A = Life < 0.6f ? 1.f : FMath::Clamp(1.f - (Life - 0.6f) / 0.4f, 0.f, 1.f);
		Text->SetColorAndOpacity(FSlateColor(Color));
		if (UCanvasPanelSlot* CanvasSlot = Cast<UCanvasPanelSlot>(Text->Slot))
		{
			CanvasSlot->SetPosition(ScreenPos);
		}
		Text->SetVisibility(ESlateVisibility::HitTestInvisible);
	}
}

void UEnderHUDWidget::UpdatePrompt(float DeltaSeconds)
{
	PromptTimer -= DeltaSeconds;
	if (PromptTimer > 0.f)
	{
		return;
	}
	PromptTimer = 0.1f;

	APawn* Binder = GetBinder();
	AActor* Target = Binder ? UEnderInteractionLibrary::FindBestInteractable(Binder) : nullptr;
	FText Prompt;
	if (Target)
	{
		Prompt = FText::Format(LOCTEXT("PromptFmt", "[F] {0}"), IEnderInteractable::Execute_GetInteractPrompt(Target));
	}
	if (InteractPromptText)
	{
		InteractPromptText->SetText(Prompt);
		InteractPromptText->SetColorAndOpacity(FSlateColor(EnderPalette::Interact()));
		InteractPromptText->SetVisibility(Target ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Collapsed);
	}
	OnInteractPrompt(Prompt, Target != nullptr);
	UpdatePinnedContract();
}

void UEnderHUDWidget::UpdatePinnedContract()
{
	const UEnderRealityClient* Client = GetRealityClient();
	if (!Client)
	{
		return;
	}
	// Pin the richest open contract.
	const FEnderContract* Best = nullptr;
	const TArray<FEnderContract> Contracts = Client->GetContracts();
	for (const FEnderContract& C : Contracts)
	{
		if (C.Status.IsEmpty() || C.Status == TEXT("open"))
		{
			if (!Best || C.Reward > Best->Reward)
			{
				Best = &C;
			}
		}
	}
	const FText Label = Best ? (Best->Label.IsEmpty() ? Best->Title : Best->Label) : FText::GetEmpty();
	const FString Key = Label.ToString();
	if (Key == LastContractLabel)
	{
		return;
	}
	LastContractLabel = Key;
	if (PinnedContractText)
	{
		PinnedContractText->SetText(Label);
		PinnedContractText->SetVisibility(Label.IsEmpty() ? ESlateVisibility::Collapsed : ESlateVisibility::HitTestInvisible);
	}
	OnPinnedContract(Label);
}

#undef LOCTEXT_NAMESPACE
