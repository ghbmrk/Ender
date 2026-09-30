#pragma once

#include "CoreMinimal.h"
#include "Core/EnderTypes.h"
#include "GameFramework/Actor.h"
#include "EnderSpawnPoint.generated.h"

class UArrowComponent;

/**
 * An authored spawn location for an encounter director. The director still checks
 * the spawn rules at the moment of spawning (≥400 cm from the Binder, never within
 * 300 cm behind them); points that fail are skipped for that spawn.
 */
UCLASS()
class ENDER_API AEnderSpawnPoint : public AActor
{
	GENERATED_BODY()

public:
	AEnderSpawnPoint();

	bool Allows(EEnderArchetype Archetype, bool bElite) const
	{
		return (!bElite || bAllowElite) && (AllowedArchetypes.Num() == 0 || AllowedArchetypes.Contains(Archetype));
	}

	/** Empty = any archetype. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Spawn") TArray<EEnderArchetype> AllowedArchetypes;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender|Spawn") bool bAllowElite = true;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Ender|Spawn") TObjectPtr<UArrowComponent> Arrow;
};
