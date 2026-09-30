#include "Combat/EnderRunRandomSubsystem.h"

#include "Engine/World.h"

void UEnderRunRandomSubsystem::BeginRun(int64 Seed)
{
	RunSeed = static_cast<uint64>(Seed);
	Streams.Reset();
}

EnderRules::FRunRandom& UEnderRunRandomSubsystem::Stream(uint64 StreamId)
{
	if (EnderRules::FRunRandom* Existing = Streams.Find(StreamId)) return *Existing;
	return Streams.Add(StreamId, EnderRules::FRunRandom::Derive(RunSeed, StreamId));
}

UEnderRunRandomSubsystem* UEnderRunRandomSubsystem::Get(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	return World ? World->GetSubsystem<UEnderRunRandomSubsystem>() : nullptr;
}
