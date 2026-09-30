#include "AI/EnderAISettings.h"

FEnderOnColourblindChanged UEnderAccessibilitySettings::OnColourblindChanged;

bool UEnderAccessibilitySettings::IsColourblindTelegraphs()
{
	return GetDefault<UEnderAccessibilitySettings>()->bColourblindTelegraphs;
}

void UEnderAccessibilitySettings::SetColourblindTelegraphs(bool bEnabled)
{
	UEnderAccessibilitySettings* Settings = GetMutableDefault<UEnderAccessibilitySettings>();
	if (Settings->bColourblindTelegraphs == bEnabled) return;
	Settings->bColourblindTelegraphs = bEnabled;
	Settings->SaveConfig();
	OnColourblindChanged.Broadcast(bEnabled);
}
