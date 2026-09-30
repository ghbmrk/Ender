#include "AbilitySystem/EnderGameplayAbility.h"

#include "Abilities/Tasks/AbilityTask_PlayMontageAndWait.h"
#include "Abilities/Tasks/AbilityTask_WaitGameplayEvent.h"
#include "AbilitySystem/EnderAbilityDefinition.h"
#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "AbilitySystem/EnderAbilityTask_Tick.h"
#include "AbilitySystem/EnderAttributeSet.h"
#include "AbilitySystem/EnderGameplayEffects.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "AbilitySystem/Notifies/ANS_AttackWindow.h"
#include "Animation/AnimMontage.h"
#include "Character/EnderPlayerCharacter.h"
#include "Combat/EnderCombatStatics.h"
#include "Combat/EnderTargetSweepComponent.h"

UEnderGameplayAbility::UEnderGameplayAbility()
{
	InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;
	NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalOnly;
	ActivationOwnedTags.AddTag(EnderTags::State_Attacking);
	ActivationBlockedTags.AddTag(EnderTags::State_Dead);
	ActivationBlockedTags.AddTag(EnderTags::State_HitReact);
}

AEnderPlayerCharacter* UEnderGameplayAbility::GetBinder() const
{
	return Cast<AEnderPlayerCharacter>(GetAvatarActorFromActorInfo());
}

UEnderAbilitySystemComponent* UEnderGameplayAbility::GetEnderASC() const
{
	return Cast<UEnderAbilitySystemComponent>(GetAbilitySystemComponentFromActorInfo());
}

UEnderTargetSweepComponent* UEnderGameplayAbility::GetSweep() const
{
	const AActor* Avatar = GetAvatarActorFromActorInfo();
	return Avatar ? Avatar->FindComponentByClass<UEnderTargetSweepComponent>() : nullptr;
}

FVector UEnderGameplayAbility::GetAimPoint() const
{
	if (const AEnderPlayerCharacter* Binder = GetBinder()) return Binder->GetAimPoint();
	const AActor* Avatar = GetAvatarActorFromActorInfo();
	return Avatar ? Avatar->GetActorLocation() + Avatar->GetActorForwardVector() * 300.f : FVector::ZeroVector;
}

FVector UEnderGameplayAbility::GetAimDirection() const
{
	const AActor* Avatar = GetAvatarActorFromActorInfo();
	if (!Avatar) return FVector::ForwardVector;
	const FVector Dir = (GetAimPoint() - Avatar->GetActorLocation()).GetSafeNormal2D();
	return Dir.IsNearlyZero() ? Avatar->GetActorForwardVector().GetSafeNormal2D() : Dir;
}

bool UEnderGameplayAbility::CheckCost(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, FGameplayTagContainer* OptionalRelevantTags) const
{
	if (!Definition || Definition->ThreadCost <= 0.f) return true;
	const UAbilitySystemComponent* ASC = ActorInfo ? ActorInfo->AbilitySystemComponent.Get() : nullptr;
	return ASC && ASC->GetNumericAttribute(UEnderAttributeSet::GetThreadAttribute()) >= Definition->ThreadCost;
}

void UEnderGameplayAbility::ApplyCost(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo) const
{
	if (Definition && Definition->ThreadCost > 0.f && ActorInfo)
		UEnderCombatStatics::AddThread(ActorInfo->AvatarActor.Get(), -Definition->ThreadCost);
}

const FGameplayTagContainer* UEnderGameplayAbility::GetCooldownTags() const
{
	CooldownTagsScratch.Reset();
	if (Definition && Definition->CooldownTag.IsValid()) CooldownTagsScratch.AddTag(Definition->CooldownTag);
	return &CooldownTagsScratch;
}

void UEnderGameplayAbility::ApplyCooldown(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo) const
{
	if (!Definition || Definition->Cooldown <= 0.f || !Definition->CooldownTag.IsValid()) return;
	UAbilitySystemComponent* ASC = ActorInfo ? ActorInfo->AbilitySystemComponent.Get() : nullptr;
	if (!ASC) return;
	// Sigil cooldown reduction applies to skills; Evade's 1.65 s is a movement constant (§29).
	const float CDR = Definition->Priority == EEnderInputPriority::Evade ? 0.f : ASC->GetNumericAttribute(UEnderAttributeSet::GetCooldownReductionAttribute());
	FGameplayEffectSpecHandle Spec = MakeOutgoingGameplayEffectSpec(Handle, ActorInfo, ActivationInfo, UEnderGE_Cooldown::StaticClass(), 1.f);
	if (!Spec.IsValid()) return;
	Spec.Data->SetSetByCallerMagnitude(EnderTags::Data_Duration, Definition->Cooldown * (1.f - CDR));
	Spec.Data->DynamicGrantedTags.AddTag(Definition->CooldownTag);
	ApplyGameplayEffectSpecToOwner(Handle, ActorInfo, ActivationInfo, Spec);
}

bool UEnderGameplayAbility::MontageHasAttackWindow(const UAnimMontage* Montage)
{
	if (!Montage) return false;
	for (const FAnimNotifyEvent& N : Montage->Notifies)
	{
		if (Cast<UANS_AttackWindow>(N.NotifyStateClass)) return true;
	}
	return false;
}

UAnimMontage* UEnderGameplayAbility::ChooseMontage() const
{
	return Definition ? Definition->Montage.Get() : nullptr;
}

float UEnderGameplayAbility::FallbackDuration() const
{
	return Definition ? Definition->Total() : 0.f;
}

void UEnderGameplayAbility::ActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo,
	const FGameplayAbilityActivationInfo ActivationInfo, const FGameplayEventData* TriggerEventData)
{
	if (!Definition || !CommitAbility(Handle, ActorInfo, ActivationInfo))
	{
		EndAbility(Handle, ActorInfo, ActivationInfo, false, true);
		return;
	}

	if (AEnderPlayerCharacter* Binder = GetBinder()) Binder->NotifyAbilityActivated(Definition->AbilityTag);
	Elapsed = WindowElapsed = 0.f;
	bInWindow = bWindowDone = false;
	LooseTagsHeld.Reset();

	UAnimMontage* Montage = ChooseMontage();
	bFallbackTimeline = !MontageHasAttackWindow(Montage);

	UEnderAbilityTask_Tick* Ticker = UEnderAbilityTask_Tick::TickEveryFrame(this);
	Ticker->OnTick.AddDynamic(this, &UEnderGameplayAbility::HandleTick);
	Ticker->ReadyForActivation();

	if (!bFallbackTimeline)
	{
		UAbilityTask_WaitGameplayEvent* Begin = UAbilityTask_WaitGameplayEvent::WaitGameplayEvent(this, EnderTags::Event_AttackWindow_Begin, nullptr, false, true);
		Begin->EventReceived.AddDynamic(this, &UEnderGameplayAbility::HandleWindowBegin);
		Begin->ReadyForActivation();
		UAbilityTask_WaitGameplayEvent* End = UAbilityTask_WaitGameplayEvent::WaitGameplayEvent(this, EnderTags::Event_AttackWindow_End, nullptr, false, true);
		End->EventReceived.AddDynamic(this, &UEnderGameplayAbility::HandleWindowEnd);
		End->ReadyForActivation();
	}

	if (Montage)
	{
		UAbilityTask_PlayMontageAndWait* Play = UAbilityTask_PlayMontageAndWait::CreatePlayMontageAndWaitProxy(this, NAME_None, Montage, 1.f);
		Play->OnCompleted.AddDynamic(this, &UEnderGameplayAbility::HandleMontageDone);
		Play->OnBlendOut.AddDynamic(this, &UEnderGameplayAbility::HandleMontageDone);
		Play->OnInterrupted.AddDynamic(this, &UEnderGameplayAbility::HandleMontageCancelled);
		Play->OnCancelled.AddDynamic(this, &UEnderGameplayAbility::HandleMontageCancelled);
		Play->ReadyForActivation();
	}

	if (Definition->CueTag.IsValid())
	{
		FGameplayCueParameters Cue;
		Cue.Location = GetAvatarActorFromActorInfo()->GetActorLocation();
		Cue.Normal = GetAimDirection();
		Cue.RawMagnitude = Definition->Radius;
		GetAbilitySystemComponentFromActorInfo()->AddGameplayCue(Definition->CueTag, Cue);
	}

	OnActivated();
	if (bFallbackTimeline) ApplyPhaseMovement();
}

void UEnderGameplayAbility::HandleTick(float DeltaTime)
{
	Elapsed += DeltaTime;
	if (bFallbackTimeline && Definition)
	{
		if (!bInWindow && !bWindowDone && Elapsed >= Definition->Windup) BeginWindow();
		if (bInWindow && Elapsed >= Definition->Windup + Definition->Active) EndWindow(true);
		SetOwnedLooseTag(EnderTags::Window_Cancel_Evade, Definition->EvadeCancelAt >= 0.f && Elapsed >= Definition->EvadeCancelAt);
		SetOwnedLooseTag(EnderTags::Window_Cancel_Skill, Definition->SkillCancelAt >= 0.f && Elapsed >= Definition->SkillCancelAt);
		ApplyPhaseMovement();
		if (!Definition->Montage && Elapsed >= FallbackDuration())
		{
			EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, false, false);
			return;
		}
	}
	if (bInWindow)
	{
		WindowElapsed += DeltaTime;
		OnAttackWindowTick(WindowElapsed, DeltaTime);
	}
}

void UEnderGameplayAbility::HandleWindowBegin(FGameplayEventData)
{
	if (!bInWindow && !bWindowDone) BeginWindow();
}

void UEnderGameplayAbility::HandleWindowEnd(FGameplayEventData)
{
	if (bInWindow) EndWindow(true);
}

void UEnderGameplayAbility::BeginWindow()
{
	bInWindow = true;
	WindowElapsed = 0.f;
	if (UEnderTargetSweepComponent* Sweep = GetSweep()) Sweep->BeginExecution();
	OnAttackWindowBegin();
	// Zero-length windows still get one query.
	OnAttackWindowTick(0.f, 0.f);
}

void UEnderGameplayAbility::EndWindow(bool bCompleted)
{
	OnAttackWindowEnd(bCompleted); // still inside the window, so a final query may deal damage
	bInWindow = false;
	bWindowDone = true;
	if (UEnderTargetSweepComponent* Sweep = GetSweep()) Sweep->EndExecution();
}

void UEnderGameplayAbility::HandleMontageDone()
{
	if (IsActive()) EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, false, false);
}

void UEnderGameplayAbility::HandleMontageCancelled()
{
	if (IsActive()) EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, false, true);
}

void UEnderGameplayAbility::SetOwnedLooseTag(const FGameplayTag& Tag, bool bOn)
{
	UAbilitySystemComponent* ASC = GetAbilitySystemComponentFromActorInfo();
	if (!ASC) return;
	const bool bHeld = LooseTagsHeld.Contains(Tag);
	if (bOn && !bHeld)
	{
		ASC->AddLooseGameplayTag(Tag);
		LooseTagsHeld.Add(Tag);
	}
	else if (!bOn && bHeld)
	{
		ASC->RemoveLooseGameplayTag(Tag);
		LooseTagsHeld.Remove(Tag);
	}
}

void UEnderGameplayAbility::ApplyPhaseMovement()
{
	AEnderPlayerCharacter* Binder = GetBinder();
	if (!Binder || !Definition) return;
	float Mul = Definition->MoveMulRecovery;
	if (Elapsed < Definition->Windup) Mul = Definition->MoveMulWindup;
	else if (Elapsed < Definition->Windup + Definition->Active) Mul = Definition->MoveMulActive;
	Binder->SetAbilityMoveMultiplier(Mul);
}

bool UEnderGameplayAbility::DealDamage(AActor* Target, const FHitResult& Hit, float BaseDamage, float Stagger, bool bFirstUltimateImpact)
{
	// §21: damage cannot occur during windup — only inside the attack window.
	if (!bInWindow || !Definition) return false;
	FEnderDamageParams Params;
	Params.BaseDamage = BaseDamage;
	Params.Stagger = Stagger;
	Params.HitWeight = Definition->HitWeight;
	Params.bFirstUltimateImpact = bFirstUltimateImpact;
	Params.DamageType = Definition->DamageType;
	return UEnderCombatStatics::ApplyDamage(GetAvatarActorFromActorInfo(), Target, Params, Hit);
}

void UEnderGameplayAbility::EndAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo,
	const FGameplayAbilityActivationInfo ActivationInfo, bool bReplicateEndAbility, bool bWasCancelled)
{
	if (bInWindow) EndWindow(false);
	for (const FGameplayTag& Tag : TArray<FGameplayTag>(LooseTagsHeld.Array())) SetOwnedLooseTag(Tag, false);
	if (UAbilitySystemComponent* ASC = GetAbilitySystemComponentFromActorInfo())
	{
		// Montage notify windows end with the montage, but an interrupted montage must not leak them.
		ASC->SetLooseGameplayTagCount(EnderTags::Window_Cancel_Evade, 0);
		ASC->SetLooseGameplayTagCount(EnderTags::Window_Cancel_Skill, 0);
		ASC->SetLooseGameplayTagCount(EnderTags::Window_Attack, 0);
		if (Definition && Definition->CueTag.IsValid()) ASC->RemoveGameplayCue(Definition->CueTag);
	}
	if (AEnderPlayerCharacter* Binder = GetBinder()) Binder->SetAbilityMoveMultiplier(1.f);
	OnEnded(bWasCancelled);
	Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}
