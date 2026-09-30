#include "UI/EnderDamageNumberQueue.h"

#include "AbilitySystem/EnderAbilitySystemComponent.h"
#include "Character/EnderCharacterBase.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "Misc/App.h"
#include "UI/EnderPalette.h"

UEnderDamageNumberQueue* UEnderDamageNumberQueue::Get(const UObject* WorldContext)
{
	const UWorld* W = WorldContext ? WorldContext->GetWorld() : nullptr;
	return W ? W->GetSubsystem<UEnderDamageNumberQueue>() : nullptr;
}

void UEnderDamageNumberQueue::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);
	for (TActorIterator<AEnderCharacterBase> It(&InWorld); It; ++It)
	{
		Watch(*It);
	}
	SpawnHandle = InWorld.AddOnActorSpawnedHandler(FOnActorSpawned::FDelegate::CreateUObject(this, &ThisClass::HandleActorSpawned));
}

void UEnderDamageNumberQueue::Deinitialize()
{
	if (UWorld* World = GetWorld())
	{
		World->RemoveOnActorSpawnedHandler(SpawnHandle);
	}
	for (const TWeakObjectPtr<UEnderAbilitySystemComponent>& ASC : Watched)
	{
		if (UEnderAbilitySystemComponent* Live = ASC.Get())
		{
			Live->OnDamagedNative.RemoveAll(this);
		}
	}
	Watched.Reset();
	Super::Deinitialize();
}

void UEnderDamageNumberQueue::HandleActorSpawned(AActor* Actor)
{
	if (AEnderCharacterBase* Character = Cast<AEnderCharacterBase>(Actor))
	{
		Watch(Character);
	}
}

void UEnderDamageNumberQueue::Watch(AEnderCharacterBase* Character)
{
	UEnderAbilitySystemComponent* ASC = Character ? Character->GetEnderASC() : nullptr;
	if (!ASC || Watched.Contains(ASC))
	{
		return;
	}
	ASC->OnDamagedNative.AddUObject(this, &ThisClass::HandleDamaged);
	Watched.Add(ASC);
}

void UEnderDamageNumberQueue::HandleDamaged(UEnderAbilitySystemComponent* Victim, const FEnderDamageEvent& Event)
{
	if (!bEnabled || !Victim || Event.Amount <= 0.f)
	{
		return;
	}
	const AActor* Avatar = Victim->GetAvatarActor();
	const APawn* Pawn = Cast<APawn>(Avatar);
	if (!Avatar || (Pawn && Pawn->IsPlayerControlled()))
	{
		return; // enemies only
	}
	const FVector Where = Event.ImpactPoint.IsNearlyZero() ? Avatar->GetActorLocation() + FVector(0.f, 0.f, 110.f) : Event.ImpactPoint;
	Push(Victim->GetUniqueID(), Event.Amount, Event.bCrit, Where);
}

void UEnderDamageNumberQueue::Push(uint32 TargetId, float Amount, bool bCrit, const FVector& WorldLocation)
{
	Queue.Push(TargetId, Amount, bCrit, GFrameCounter, WorldLocation.X, WorldLocation.Y, WorldLocation.Z);
}

void UEnderDamageNumberQueue::Tick(float DeltaTime)
{
	// Real time, so hitstop never freezes the numbers.
	Queue.Tick(FApp::GetDeltaTime());
}

TArray<FEnderDamageNumber> UEnderDamageNumberQueue::GetLiveNumbers() const
{
	TArray<FEnderDamageNumber> Out;
	Out.Reserve(static_cast<int32>(Queue.Live.size()));
	for (const EnderRules::DamageNumbers::FEntry& E : Queue.Live)
	{
		FEnderDamageNumber& N = Out.AddDefaulted_GetRef();
		N.Id = static_cast<int32>(E.Id);
		N.Amount = static_cast<float>(E.Amount);
		N.bCrit = E.bCrit;
		N.Hits = E.Hits;
		N.WorldLocation = FVector(E.X, E.Y, E.Z);
		N.Life = static_cast<float>(E.Age / EnderRules::DamageNumbers::Lifetime);
		N.FontSize = static_cast<int32>(E.bCrit ? EnderRules::DamageNumbers::CritSizePx : EnderRules::DamageNumbers::NormalSizePx);
		N.Color = E.bCrit ? EnderPalette::Ochre() : EnderPalette::PaperWhite();
	}
	return Out;
}
