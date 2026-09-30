#include "AbilitySystem/Notifies/ANS_AttackWindow.h"

#include "AbilitySystemBlueprintLibrary.h"
#include "AbilitySystemComponent.h"
#include "AbilitySystem/EnderGameplayTags.h"
#include "Character/EnderPlayerCharacter.h"
#include "Components/SkeletalMeshComponent.h"

namespace
{
	UAbilitySystemComponent* OwnerASC(USkeletalMeshComponent* Mesh)
	{
		return Mesh ? UAbilitySystemBlueprintLibrary::GetAbilitySystemComponent(Mesh->GetOwner()) : nullptr;
	}

	void SendEvent(USkeletalMeshComponent* Mesh, const FGameplayTag& Tag)
	{
		if (AActor* Owner = Mesh ? Mesh->GetOwner() : nullptr)
		{
			FGameplayEventData Payload;
			Payload.EventTag = Tag;
			Payload.Instigator = Owner;
			UAbilitySystemBlueprintLibrary::SendGameplayEventToActor(Owner, Tag, Payload);
		}
	}

	FGameplayTag CancelTag(EEnderCancelKind Kind)
	{
		return Kind == EEnderCancelKind::Evade ? EnderTags::Window_Cancel_Evade : EnderTags::Window_Cancel_Skill;
	}
}

void UANS_AttackWindow::NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference)
{
	Super::NotifyBegin(MeshComp, Animation, TotalDuration, EventReference);
	if (UAbilitySystemComponent* ASC = OwnerASC(MeshComp)) ASC->AddLooseGameplayTag(EnderTags::Window_Attack);
	SendEvent(MeshComp, EnderTags::Event_AttackWindow_Begin);
}

void UANS_AttackWindow::NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference)
{
	if (UAbilitySystemComponent* ASC = OwnerASC(MeshComp)) ASC->RemoveLooseGameplayTag(EnderTags::Window_Attack);
	SendEvent(MeshComp, EnderTags::Event_AttackWindow_End);
	Super::NotifyEnd(MeshComp, Animation, EventReference);
}

void UANS_MovementOverride::NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference)
{
	Super::NotifyBegin(MeshComp, Animation, TotalDuration, EventReference);
	if (AEnderPlayerCharacter* Binder = MeshComp ? Cast<AEnderPlayerCharacter>(MeshComp->GetOwner()) : nullptr)
		Binder->SetAbilityMoveMultiplier(SpeedMultiplier);
}

void UANS_MovementOverride::NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference)
{
	if (AEnderPlayerCharacter* Binder = MeshComp ? Cast<AEnderPlayerCharacter>(MeshComp->GetOwner()) : nullptr)
		Binder->SetAbilityMoveMultiplier(1.f);
	Super::NotifyEnd(MeshComp, Animation, EventReference);
}

FString UANS_MovementOverride::GetNotifyName_Implementation() const
{
	return FString::Printf(TEXT("Move ×%.2f"), SpeedMultiplier);
}

void UANS_CancelWindow::NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference)
{
	Super::NotifyBegin(MeshComp, Animation, TotalDuration, EventReference);
	if (UAbilitySystemComponent* ASC = OwnerASC(MeshComp)) ASC->AddLooseGameplayTag(CancelTag(Kind));
}

void UANS_CancelWindow::NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference)
{
	if (UAbilitySystemComponent* ASC = OwnerASC(MeshComp)) ASC->RemoveLooseGameplayTag(CancelTag(Kind));
	Super::NotifyEnd(MeshComp, Animation, EventReference);
}

FString UANS_CancelWindow::GetNotifyName_Implementation() const
{
	return Kind == EEnderCancelKind::Evade ? TEXT("Cancel: Evade") : TEXT("Cancel: Skill");
}

void UANS_Invulnerability::NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference)
{
	Super::NotifyBegin(MeshComp, Animation, TotalDuration, EventReference);
	if (UAbilitySystemComponent* ASC = OwnerASC(MeshComp)) ASC->AddLooseGameplayTag(EnderTags::State_Invulnerable);
}

void UANS_Invulnerability::NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference)
{
	if (UAbilitySystemComponent* ASC = OwnerASC(MeshComp)) ASC->RemoveLooseGameplayTag(EnderTags::State_Invulnerable);
	Super::NotifyEnd(MeshComp, Animation, EventReference);
}

void UANS_GameplayCueWindow::NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference)
{
	Super::NotifyBegin(MeshComp, Animation, TotalDuration, EventReference);
	if (UAbilitySystemComponent* ASC = OwnerASC(MeshComp); ASC && CueTag.IsValid()) ASC->AddGameplayCue(CueTag);
}

void UANS_GameplayCueWindow::NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference)
{
	if (UAbilitySystemComponent* ASC = OwnerASC(MeshComp); ASC && CueTag.IsValid()) ASC->RemoveGameplayCue(CueTag);
	Super::NotifyEnd(MeshComp, Animation, EventReference);
}

FString UANS_GameplayCueWindow::GetNotifyName_Implementation() const
{
	return CueTag.IsValid() ? CueTag.ToString() : TEXT("Gameplay Cue");
}
