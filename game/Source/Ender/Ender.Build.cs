using UnrealBuildTool;

public class Ender : ModuleRules
{
	public Ender(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		CppStandard = CppStandardVersion.Cpp20;

		// Folders are included by path from the module root, e.g. "Combat/EnderTargetSweepComponent.h".
		PublicIncludePaths.Add(ModuleDirectory);

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput",
			"GameplayAbilities", "GameplayTags", "GameplayTasks",
			"AIModule", "NavigationSystem", "StateTreeModule", "GameplayStateTreeModule",
			"MotionWarping", "Niagara", "UMG", "Slate", "SlateCore",
			"PhysicsCore", "DeveloperSettings"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"HTTP", "Json", "JsonUtilities"
		});

		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.Add("FunctionalTesting");
		}
	}
}
