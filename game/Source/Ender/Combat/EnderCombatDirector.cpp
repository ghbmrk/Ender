#include "Combat/EnderCombatDirector.h"

#include "AI/EnderEnemyCharacter.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Rules/CombatRules.h"

AEnderCombatDirector::AEnderCombatDirector()
{
	PrimaryActorTick.bCanEverTick = true;
	SetCanBeDamaged(false);
}

AEnderCombatDirector* AEnderCombatDirector::Find(const UObject* WorldContext)
{
	UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	if (!World) return nullptr;
	for (TActorIterator<AEnderCombatDirector> It(World); It; ++It)
	{
		if (IsValid(*It)) return *It;
	}
	return nullptr;
}

AEnderCombatDirector* AEnderCombatDirector::Get(const UObject* WorldContext)
{
	if (AEnderCombatDirector* Existing = Find(WorldContext)) return Existing;
	UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	if (!World || !World->IsGameWorld() || World->bIsTearingDown) return nullptr;
	FActorSpawnParameters Params;
	Params.Name = TEXT("EnderCombatDirector");
	Params.NameMode = FActorSpawnParameters::ESpawnActorNameMode::Requested;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	return World->SpawnActor<AEnderCombatDirector>(AEnderCombatDirector::StaticClass(), FTransform::Identity, Params);
}

uint32 AEnderCombatDirector::IdOf(const AEnderEnemyCharacter* Enemy)
{
	return Enemy ? Enemy->GetUniqueID() : 0u;
}

bool AEnderCombatDirector::ScreenPosition(const AActor* Actor, double& OutU, double& OutV) const
{
	OutU = OutV = 0.5;
	APlayerController* PC = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr;
	if (!PC || !PC->IsLocalController()) return true;
	int32 SizeX = 0, SizeY = 0;
	PC->GetViewportSize(SizeX, SizeY);
	if (SizeX <= 0 || SizeY <= 0) return true;

	FVector2D Screen;
	if (!PC->ProjectWorldLocationToScreen(Actor->GetActorLocation(), Screen, false))
	{
		// Behind the camera: as far off-screen as it gets.
		OutU = OutV = -1.0;
		return false;
	}
	OutU = Screen.X / SizeX;
	OutV = Screen.Y / SizeY;
	return true;
}

bool AEnderCombatDirector::IsWithinFairView(const AActor* Actor) const
{
	if (!Actor) return false;
	double U, V;
	ScreenPosition(Actor, U, V);
	return EnderRules::Fairness::InsideViewportWithMargin(U, V);
}

bool AEnderCombatDirector::CanBeginAttack(const AEnderEnemyCharacter* Enemy) const
{
	if (!Enemy || AreAttacksSuppressed()) return false;
	double U, V;
	ScreenPosition(Enemy, U, V);
	// Ordinary enemies have no off-screen warning in the MVP: WarningAge < 0 means "wait until visible".
	return EnderRules::Fairness::MayBeginAttack(Enemy->IsBoss(), U, V, -1.0);
}

bool AEnderCombatDirector::MayExecuteAttack(const AEnderEnemyCharacter* Enemy) const
{
	if (!Enemy) return false;
	return Enemy->IsBoss() || IsWithinFairView(Enemy);
}

bool AEnderCombatDirector::TryAcquireToken(AEnderEnemyCharacter* Enemy, EEnderTokenPool Pool)
{
	if (!Enemy || AreAttacksSuppressed()) return false;
	PruneHolders();
	const uint32 Id = IdOf(Enemy);
	if (!Tokens.TryAcquire(EnderConvert::ToRules(Pool), Id)) return false;
	Holders.Add(Id, Enemy);
	return true;
}

void AEnderCombatDirector::ReleaseToken(AEnderEnemyCharacter* Enemy, EEnderTokenPool Pool)
{
	const uint32 Id = IdOf(Enemy);
	Tokens.Release(EnderConvert::ToRules(Pool), Id);
	bool bStillHolds = false;
	for (int32 P = 0; P < EnderRules::NumTokenPools; ++P)
	{
		bStillHolds |= Tokens.Holds(static_cast<EnderRules::ETokenPool>(P), Id);
	}
	if (!bStillHolds) Holders.Remove(Id);
}

void AEnderCombatDirector::ReleaseAllTokens(AEnderEnemyCharacter* Enemy)
{
	const uint32 Id = IdOf(Enemy);
	Tokens.ReleaseAll(Id);
	Holders.Remove(Id);
}

bool AEnderCombatDirector::HoldsToken(const AEnderEnemyCharacter* Enemy, EEnderTokenPool Pool) const
{
	return Tokens.Holds(EnderConvert::ToRules(Pool), IdOf(Enemy));
}

int32 AEnderCombatDirector::GetTokensInUse(EEnderTokenPool Pool) const
{
	return Tokens.InUse(EnderConvert::ToRules(Pool));
}

int32 AEnderCombatDirector::GetTokenCapacity(EEnderTokenPool Pool) const
{
	return Tokens.Capacity[static_cast<int32>(Pool)];
}

void AEnderCombatDirector::SuppressAttacks(float Seconds)
{
	SuppressedLeft = FMath::Max(SuppressedLeft, Seconds);
	// Copy first: AbortAttack calls back into ReleaseToken and edits Holders.
	TArray<TWeakObjectPtr<AEnderEnemyCharacter>> Current;
	Holders.GenerateValueArray(Current);
	for (const TWeakObjectPtr<AEnderEnemyCharacter>& Weak : Current)
	{
		if (AEnderEnemyCharacter* Enemy = Weak.Get()) Enemy->AbortAttack();
	}
	PruneHolders();
}

void AEnderCombatDirector::ResetTokens()
{
	Tokens = EnderRules::FAttackTokenPools();
	Holders.Reset();
}

void AEnderCombatDirector::PruneHolders()
{
	for (auto It = Holders.CreateIterator(); It; ++It)
	{
		const AEnderEnemyCharacter* Enemy = It.Value().Get();
		if (!Enemy || !Enemy->IsAlive())
		{
			Tokens.ReleaseAll(It.Key());
			It.RemoveCurrent();
		}
	}
}

void AEnderCombatDirector::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (SuppressedLeft > 0.f) SuppressedLeft = FMath::Max(0.f, SuppressedLeft - DeltaSeconds);
	PruneHolders();
	ensureMsgf(Tokens.WithinCaps(), TEXT("Attack token caps exceeded"));
}
