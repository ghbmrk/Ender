#pragma once

#include "Animation/AnimNotifies/AnimNotifyState.h"
#include "GameplayTagContainer.h"
#include "ANS_AttackWindow.generated.h"

/*
 * §21 montage notify states. Gameplay timing lives here, not in timers inside
 * abilities. Each one talks to the owner's ability system: events for window
 * edges, loose tags for windows the rest of the code queries.
 */

/** Damage may be dealt only between Begin and End. */
UCLASS(meta = (DisplayName = "ANS_AttackWindow"))
class ENDER_API UANS_AttackWindow : public UAnimNotifyState
{
	GENERATED_BODY()
public:
	virtual void NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference) override;
	virtual void NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference) override;
	virtual FString GetNotifyName_Implementation() const override { return TEXT("Attack Window"); }
};

/** Scales the Binder's movement speed while active (e.g. Thread Lash windup ×0.70). */
UCLASS(meta = (DisplayName = "ANS_MovementOverride"))
class ENDER_API UANS_MovementOverride : public UAnimNotifyState
{
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender", meta = (ClampMin = "0.0", ClampMax = "1.5"))
	float SpeedMultiplier = 1.f;

	virtual void NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference) override;
	virtual void NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference) override;
	virtual FString GetNotifyName_Implementation() const override;
};

UENUM(BlueprintType)
enum class EEnderCancelKind : uint8
{
	Evade,
	Skill,
};

/** While active, the running ability can be cancelled by Evade or by another skill. Usually runs to the montage end. */
UCLASS(meta = (DisplayName = "ANS_CancelWindow"))
class ENDER_API UANS_CancelWindow : public UAnimNotifyState
{
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender") EEnderCancelKind Kind = EEnderCancelKind::Skill;

	virtual void NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference) override;
	virtual void NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference) override;
	virtual FString GetNotifyName_Implementation() const override;
};

/** State.Invulnerable while active (Evade 0.055–0.255 s). */
UCLASS(meta = (DisplayName = "ANS_Invulnerability"))
class ENDER_API UANS_Invulnerability : public UAnimNotifyState
{
	GENERATED_BODY()
public:
	virtual void NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference) override;
	virtual void NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference) override;
	virtual FString GetNotifyName_Implementation() const override { return TEXT("Invulnerable"); }
};

/** Holds a gameplay cue (VFX/SFX) exactly as long as the window, so visuals and gameplay share timing. */
UCLASS(meta = (DisplayName = "ANS_GameplayCueWindow"))
class ENDER_API UANS_GameplayCueWindow : public UAnimNotifyState
{
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ender", meta = (Categories = "GameplayCue")) FGameplayTag CueTag;

	virtual void NotifyBegin(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, float TotalDuration, const FAnimNotifyEventReference& EventReference) override;
	virtual void NotifyEnd(USkeletalMeshComponent* MeshComp, UAnimSequenceBase* Animation, const FAnimNotifyEventReference& EventReference) override;
	virtual FString GetNotifyName_Implementation() const override;
};
