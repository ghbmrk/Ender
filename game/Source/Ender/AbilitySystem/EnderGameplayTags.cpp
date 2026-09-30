#include "AbilitySystem/EnderGameplayTags.h"

namespace EnderTags
{
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(State_Attacking, "State.Attacking", "An ability between windup start and recovery end");
	UE_DEFINE_GAMEPLAY_TAG(State_Evading, "State.Evading");
	UE_DEFINE_GAMEPLAY_TAG(State_Staggered, "State.Staggered");
	UE_DEFINE_GAMEPLAY_TAG(State_Dead, "State.Dead");
	UE_DEFINE_GAMEPLAY_TAG(State_Rooted, "State.Rooted");
	UE_DEFINE_GAMEPLAY_TAG(State_Invulnerable, "State.Invulnerable");
	UE_DEFINE_GAMEPLAY_TAG(State_HitReact, "State.HitReact");
	UE_DEFINE_GAMEPLAY_TAG(State_CastLocked, "State.CastLocked");

	UE_DEFINE_GAMEPLAY_TAG(Ability_Basic_ThreadLash, "Ability.Basic.ThreadLash");
	UE_DEFINE_GAMEPLAY_TAG(Ability_Core_Sever, "Ability.Core.Sever");
	UE_DEFINE_GAMEPLAY_TAG(Ability_Control_Bind, "Ability.Control.Bind");
	UE_DEFINE_GAMEPLAY_TAG(Ability_Area_Unravel, "Ability.Area.Unravel");
	UE_DEFINE_GAMEPLAY_TAG(Ability_Defense_WardingSigil, "Ability.Defense.WardingSigil");
	UE_DEFINE_GAMEPLAY_TAG(Ability_Ultimate_GrandFracture, "Ability.Ultimate.GrandFracture");
	UE_DEFINE_GAMEPLAY_TAG(Ability_Movement_Evade, "Ability.Movement.Evade");
	UE_DEFINE_GAMEPLAY_TAG(Ability_Draught, "Ability.Draught");

	UE_DEFINE_GAMEPLAY_TAG(Cooldown_Bind, "Cooldown.Bind");
	UE_DEFINE_GAMEPLAY_TAG(Cooldown_Unravel, "Cooldown.Unravel");
	UE_DEFINE_GAMEPLAY_TAG(Cooldown_WardingSigil, "Cooldown.WardingSigil");
	UE_DEFINE_GAMEPLAY_TAG(Cooldown_GrandFracture, "Cooldown.GrandFracture");
	UE_DEFINE_GAMEPLAY_TAG(Cooldown_Evade, "Cooldown.Evade");
	UE_DEFINE_GAMEPLAY_TAG(Cooldown_Draught, "Cooldown.Draught");

	UE_DEFINE_GAMEPLAY_TAG(Damage_Physical, "Damage.Physical");
	UE_DEFINE_GAMEPLAY_TAG(Damage_Ender, "Damage.Ender");

	UE_DEFINE_GAMEPLAY_TAG(Effect_Barrier, "Effect.Barrier");
	UE_DEFINE_GAMEPLAY_TAG(Effect_Root, "Effect.Root");
	UE_DEFINE_GAMEPLAY_TAG(Effect_Slow, "Effect.Slow");

	UE_DEFINE_GAMEPLAY_TAG(Enemy_Normal, "Enemy.Normal");
	UE_DEFINE_GAMEPLAY_TAG(Enemy_Elite, "Enemy.Elite");
	UE_DEFINE_GAMEPLAY_TAG(Enemy_Boss, "Enemy.Boss");

	UE_DEFINE_GAMEPLAY_TAG(Data_Damage, "Data.Damage");
	UE_DEFINE_GAMEPLAY_TAG(Data_Stagger, "Data.Stagger");
	UE_DEFINE_GAMEPLAY_TAG(Data_TemporaryMultiplier, "Data.TemporaryMultiplier");
	UE_DEFINE_GAMEPLAY_TAG(Data_Duration, "Data.Duration");
	UE_DEFINE_GAMEPLAY_TAG(Data_Magnitude, "Data.Magnitude");

	UE_DEFINE_GAMEPLAY_TAG(Event_AttackWindow_Begin, "Event.AttackWindow.Begin");
	UE_DEFINE_GAMEPLAY_TAG(Event_AttackWindow_End, "Event.AttackWindow.End");
	UE_DEFINE_GAMEPLAY_TAG(Event_CancelWindow_Evade, "Event.CancelWindow.Evade");
	UE_DEFINE_GAMEPLAY_TAG(Event_CancelWindow_Skill, "Event.CancelWindow.Skill");
	UE_DEFINE_GAMEPLAY_TAG(Event_HitReact, "Event.HitReact");
	UE_DEFINE_GAMEPLAY_TAG(Event_Death, "Event.Death");

	UE_DEFINE_GAMEPLAY_TAG(Window_Cancel_Evade, "Window.Cancel.Evade");
	UE_DEFINE_GAMEPLAY_TAG(Window_Cancel_Skill, "Window.Cancel.Skill");
	UE_DEFINE_GAMEPLAY_TAG(Window_Attack, "Window.Attack");
}
