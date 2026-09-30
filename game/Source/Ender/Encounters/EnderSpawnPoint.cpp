#include "Encounters/EnderSpawnPoint.h"

#include "Components/ArrowComponent.h"

AEnderSpawnPoint::AEnderSpawnPoint()
{
	PrimaryActorTick.bCanEverTick = false;
	Arrow = CreateDefaultSubobject<UArrowComponent>(TEXT("Arrow"));
	Arrow->SetHiddenInGame(true);
	Arrow->ArrowColor = FColor(0x54, 0x31, 0x31);
	RootComponent = Arrow;
	SetCanBeDamaged(false);
}
