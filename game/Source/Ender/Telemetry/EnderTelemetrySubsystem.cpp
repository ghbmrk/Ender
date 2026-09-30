#include "Telemetry/EnderTelemetrySubsystem.h"

#include "Dom/JsonObject.h"
#include "Ender.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Reality/EnderRealityJson.h"
#include "Rules/TelemetryRules.h"

namespace
{
	constexpr int32 MaxBufferedLines = 256;

	FString EnumName(const UEnum* Enum, int64 Value) { return Enum ? Enum->GetNameStringByValue(Value) : FString::FromInt(static_cast<int32>(Value)); }
}

UEnderTelemetrySubsystem* UEnderTelemetrySubsystem::Get(const UObject* WorldContext)
{
	const UWorld* W = GEngine ? GEngine->GetWorldFromContextObject(WorldContext, EGetWorldErrorMode::ReturnNull) : nullptr;
	const UGameInstance* GI = W ? W->GetGameInstance() : nullptr;
	return GI ? GI->GetSubsystem<UEnderTelemetrySubsystem>() : nullptr;
}

void UEnderTelemetrySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	SessionStart = FPlatformTime::Seconds();
	SkillUses.Init(0, 6);
	const FString Dir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Telemetry"));
	IFileManager::Get().MakeDirectory(*Dir, true);
	FilePath = FPaths::Combine(Dir, FString::Printf(TEXT("session-%s.jsonl"), *FDateTime::Now().ToString(TEXT("%Y%m%d-%H%M%S"))));
	Write(TEXT("session-start"), MakeShared<FJsonObject>());
}

void UEnderTelemetrySubsystem::Deinitialize()
{
	const TSharedRef<FJsonObject> Summary = MakeShared<FJsonObject>();
	Summary->SetNumberField(TEXT("lootPickupRate"), GetLootPickupRate());
	Summary->SetNumberField(TEXT("evadeSuccessRate"), GetEvadeSuccessRate());
	Summary->SetNumberField(TEXT("formsInspected"), FormsInspected);
	Summary->SetNumberField(TEXT("formsEquipped"), FormsEquipped);
	Summary->SetNumberField(TEXT("threadCappedSeconds"), ThreadCappedSeconds);
	Summary->SetNumberField(TEXT("threadEmptySeconds"), ThreadEmptySeconds);
	Summary->SetNumberField(TEXT("offscreenHits"), OffscreenHits);
	Summary->SetNumberField(TEXT("economyRealmChoices"), EconomyRealmChoices);
	Summary->SetNumberField(TEXT("realmChoices"), RealmChoices);
	TArray<TSharedPtr<FJsonValue>> Warnings;
	for (const FEnderTelemetryWarning& W : ComputeWarnings())
	{
		UE_LOG(LogEnder, Warning, TEXT("Telemetry: %s"), *W.Message);
		Warnings.Add(MakeShared<FJsonValueString>(W.Message));
	}
	Summary->SetArrayField(TEXT("warnings"), Warnings);
	Write(TEXT("session-summary"), Summary);
	Flush();
	Super::Deinitialize();
}

void UEnderTelemetrySubsystem::Write(const FString& Type, const TSharedRef<FJsonObject>& Fields)
{
	Fields->SetStringField(TEXT("type"), Type);
	Fields->SetNumberField(TEXT("t"), FPlatformTime::Seconds() - SessionStart);
	Buffer.Add(EnderRealityJson::ToString(Fields));
	if (Buffer.Num() >= MaxBufferedLines)
	{
		Flush();
	}
}

void UEnderTelemetrySubsystem::Flush()
{
	if (Buffer.Num() == 0 || FilePath.IsEmpty())
	{
		return;
	}
	const FString Text = FString::Join(Buffer, TEXT("\n")) + TEXT("\n");
	Buffer.Reset();
	FFileHelper::SaveStringToFile(Text, *FilePath, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM, &IFileManager::Get(), FILEWRITE_Append);
}

void UEnderTelemetrySubsystem::RecordRoomStarted(EEnderRoomKind Room)
{
	const double Now = FPlatformTime::Seconds();
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("room"), EnumName(StaticEnum<EEnderRoomKind>(), static_cast<int64>(Room)));
	if (LastFightEnded >= 0.0)
	{
		F->SetNumberField(TEXT("secondsSinceLastFight"), Now - LastFightEnded);
	}
	Write(TEXT("room-start"), F);
}

void UEnderTelemetrySubsystem::RecordRoomDuration(EEnderRoomKind Room, float Seconds)
{
	RoomDurations.Add(Seconds);
	LastFightEnded = FPlatformTime::Seconds();
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("room"), EnumName(StaticEnum<EEnderRoomKind>(), static_cast<int64>(Room)));
	F->SetNumberField(TEXT("seconds"), Seconds);
	Write(TEXT("room-clear"), F);
	Flush();
}

void UEnderTelemetrySubsystem::RecordTimeToKill(EEnderArchetype Archetype, bool bElite, float Seconds)
{
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("archetype"), EnumName(StaticEnum<EEnderArchetype>(), static_cast<int64>(Archetype)));
	F->SetBoolField(TEXT("elite"), bElite);
	F->SetNumberField(TEXT("seconds"), Seconds);
	Write(TEXT("time-to-kill"), F);
}

void UEnderTelemetrySubsystem::RecordDamageTaken(FName AttackId, float Amount)
{
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("attack"), AttackId.ToString());
	F->SetNumberField(TEXT("amount"), Amount);
	Write(TEXT("damage-taken"), F);
}

void UEnderTelemetrySubsystem::RecordEvade(bool bSuccess)
{
	++EvadeAttempts;
	EvadeSuccesses += bSuccess ? 1 : 0;
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetBoolField(TEXT("success"), bSuccess);
	Write(TEXT("evade"), F);
}

void UEnderTelemetrySubsystem::RecordDeath(FName Cause)
{
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("cause"), Cause.ToString());
	Write(TEXT("death"), F);
	Flush();
}

void UEnderTelemetrySubsystem::RecordAbilityUse(int32 Slot, FName AbilityName)
{
	if (Slot >= 1 && Slot <= 6)
	{
		++SkillUses[Slot - 1];
	}
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetNumberField(TEXT("slot"), Slot);
	F->SetStringField(TEXT("ability"), AbilityName.ToString());
	Write(TEXT("ability"), F);
}

void UEnderTelemetrySubsystem::RecordThreadCapped(float Seconds)
{
	ThreadCappedSeconds += Seconds;
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetNumberField(TEXT("seconds"), Seconds);
	Write(TEXT("thread-capped"), F);
}

void UEnderTelemetrySubsystem::RecordThreadEmpty(float Seconds)
{
	ThreadEmptySeconds += Seconds;
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetNumberField(TEXT("seconds"), Seconds);
	Write(TEXT("thread-empty"), F);
}

void UEnderTelemetrySubsystem::RecordBossPhase(int32 Phase, float Seconds)
{
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetNumberField(TEXT("phase"), Phase);
	F->SetNumberField(TEXT("seconds"), Seconds);
	Write(TEXT("boss-phase"), F);
}

void UEnderTelemetrySubsystem::RecordBossKill(float Seconds, bool bFirstKill)
{
	if (bFirstKill)
	{
		BossFirstKills.Add(Seconds);
	}
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetNumberField(TEXT("seconds"), Seconds);
	F->SetBoolField(TEXT("firstKill"), bFirstKill);
	Write(TEXT("boss-kill"), F);
	Flush();
}

void UEnderTelemetrySubsystem::RecordOffscreenHit(FName AttackerName)
{
	++OffscreenHits;
	UE_LOG(LogEnder, Warning, TEXT("Telemetry: off-screen hit by %s"), *AttackerName.ToString());
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("attacker"), AttackerName.ToString());
	Write(TEXT("offscreen-hit"), F);
}

void UEnderTelemetrySubsystem::RecordLootDropped(EEnderLootKind Kind)
{
	++LootDropped;
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("kind"), EnumName(StaticEnum<EEnderLootKind>(), static_cast<int64>(Kind)));
	Write(TEXT("loot-drop"), F);
}

void UEnderTelemetrySubsystem::RecordLootPickedUp(EEnderLootKind Kind)
{
	++LootPickedUp;
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("kind"), EnumName(StaticEnum<EEnderLootKind>(), static_cast<int64>(Kind)));
	Write(TEXT("loot-pickup"), F);
}

void UEnderTelemetrySubsystem::RecordFormInspected(const FString& CandidateId)
{
	++FormsInspected;
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("form"), CandidateId);
	Write(TEXT("form-inspected"), F);
}

void UEnderTelemetrySubsystem::RecordFormEquipped(const FString& CandidateId, EEnderGearSlot Slot)
{
	++FormsEquipped;
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("form"), CandidateId);
	F->SetStringField(TEXT("slot"), EnumName(StaticEnum<EEnderGearSlot>(), static_cast<int64>(Slot)));
	Write(TEXT("form-equipped"), F);
}

void UEnderTelemetrySubsystem::RecordTemperSelection(const FString& Emphasis)
{
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("emphasis"), Emphasis);
	Write(TEXT("temper"), F);
}

void UEnderTelemetrySubsystem::RecordRealmSelection(const FString& RealmId, bool bEconomyDriven)
{
	++RealmChoices;
	EconomyRealmChoices += bEconomyDriven ? 1 : 0;
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetStringField(TEXT("realm"), RealmId);
	F->SetBoolField(TEXT("economyDriven"), bEconomyDriven);
	Write(TEXT("realm-selection"), F);
}

void UEnderTelemetrySubsystem::RecordRealmPacing(float ActiveSeconds, float CombatShare)
{
	const TSharedRef<FJsonObject> F = MakeShared<FJsonObject>();
	F->SetNumberField(TEXT("activeSeconds"), ActiveSeconds);
	F->SetNumberField(TEXT("combatShare"), CombatShare);
	Write(TEXT("realm-pacing"), F);
	Flush();
}

float UEnderTelemetrySubsystem::GetLootPickupRate() const
{
	return LootDropped > 0 ? static_cast<float>(LootPickedUp) / static_cast<float>(LootDropped) : 0.f;
}

float UEnderTelemetrySubsystem::GetEvadeSuccessRate() const
{
	return EvadeAttempts > 0 ? static_cast<float>(EvadeSuccesses) / static_cast<float>(EvadeAttempts) : 0.f;
}

TArray<FEnderTelemetryWarning> UEnderTelemetrySubsystem::ComputeWarnings() const
{
	using namespace EnderRules::TelemetryRules;
	const std::vector<int32_t> Uses(SkillUses.GetData(), SkillUses.GetData() + SkillUses.Num());
	const std::vector<double> Rooms(RoomDurations.GetData(), RoomDurations.GetData() + RoomDurations.Num());
	const std::vector<double> Boss(BossFirstKills.GetData(), BossFirstKills.GetData() + BossFirstKills.Num());

	TArray<FEnderTelemetryWarning> Out;
	for (const FWarning& W : Evaluate(Uses, Rooms, OffscreenHits, Boss))
	{
		FEnderTelemetryWarning& O = Out.AddDefaulted_GetRef();
		O.Value = static_cast<float>(W.Value);
		switch (W.Kind)
		{
		case EWarning::SkillUnderused:
			O.Code = TEXT("skill-underused");
			O.SkillSlot = W.Index + 1;
			O.Message = FString::Printf(TEXT("Skill %d used for %.1f%% of casts (<5%%)"), O.SkillSlot, W.Value * 100.0);
			break;
		case EWarning::SkillOverused:
			O.Code = TEXT("skill-overused");
			O.SkillSlot = W.Index + 1;
			O.Message = FString::Printf(TEXT("Skill %d used for %.1f%% of casts (>45%%)"), O.SkillSlot, W.Value * 100.0);
			break;
		case EWarning::RoomsTooSlow:
			O.Code = TEXT("rooms-too-slow");
			O.Message = FString::Printf(TEXT("Median room took %.1f s (>55 s)"), W.Value);
			break;
		case EWarning::RoomsTooFast:
			O.Code = TEXT("rooms-too-fast");
			O.Message = FString::Printf(TEXT("Median room took %.1f s (<15 s)"), W.Value);
			break;
		case EWarning::OffscreenHits:
			O.Code = TEXT("offscreen-hits");
			O.Message = FString::Printf(TEXT("%d off-screen hits (must be 0)"), OffscreenHits);
			break;
		case EWarning::BossTooSlow:
			O.Code = TEXT("boss-too-slow");
			O.Message = FString::Printf(TEXT("Median boss first kill %.1f s (>150 s)"), W.Value);
			break;
		}
	}
	return Out;
}
