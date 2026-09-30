#include "Items/EnderInteractable.h"

#include "CollisionQueryParams.h"
#include "Engine/OverlapResult.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Items/EnderLootDrop.h"

bool IEnderInteractable::CanInteract_Implementation(APawn* Instigator) const
{
	return Instigator != nullptr;
}

void IEnderInteractable::Interact_Implementation(APawn* Instigator)
{
}

FText IEnderInteractable::GetInteractPrompt_Implementation() const
{
	return FText::GetEmpty();
}

AActor* UEnderInteractionLibrary::FindBestInteractable(APawn* Pawn, float Radius)
{
	UWorld* World = Pawn ? Pawn->GetWorld() : nullptr;
	if (!World)
	{
		return nullptr;
	}
	TArray<FOverlapResult> Overlaps;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(EnderInteract), false, Pawn);
	World->OverlapMultiByObjectType(Overlaps, Pawn->GetActorLocation(), FQuat::Identity,
		FCollisionObjectQueryParams(FCollisionObjectQueryParams::InitType::AllObjects), FCollisionShape::MakeSphere(Radius), Params);

	AActor* Best = nullptr;
	float BestScore = TNumericLimits<float>::Max();
	for (const FOverlapResult& O : Overlaps)
	{
		AActor* A = O.GetActor();
		if (!A || A == Best || !A->Implements<UEnderInteractable>() || !IEnderInteractable::Execute_CanInteract(A, Pawn))
		{
			continue;
		}
		// Loot wins ties so a drop at the shrine's foot is picked up first.
		const float Score = FVector::DistSquared2D(A->GetActorLocation(), Pawn->GetActorLocation()) - (A->IsA<AEnderLootDrop>() ? 2500.f : 0.f);
		if (Score < BestScore)
		{
			BestScore = Score;
			Best = A;
		}
	}
	return Best;
}

bool UEnderInteractionLibrary::TryInteract(APawn* Pawn, float Radius)
{
	AActor* Target = FindBestInteractable(Pawn, Radius);
	if (!Target)
	{
		return false;
	}
	IEnderInteractable::Execute_Interact(Target, Pawn);
	return true;
}
