#pragma once

#include "CoreMinimal.h"
#include "Items/EnderFormTypes.h"

/**
 * The art-direction palette (sRGB hex → linear colours) and the 1080p HUD layout.
 * Fonts: Alegreya SC for titles and numbers, Atkinson Hyperlegible for body text
 * (font assets live in Content/UI/Fonts).
 */
namespace EnderPalette
{
	inline FLinearColor Hex(uint8 R, uint8 G, uint8 B) { return FLinearColor(FColor(R, G, B, 255)); }

	inline FLinearColor Ink() { return Hex(0x24, 0x21, 0x2A); }
	inline FLinearColor PlayerEdge() { return Hex(0x30, 0x36, 0x5A); }
	inline FLinearColor EliteEdge() { return Hex(0x54, 0x31, 0x31); }
	inline FLinearColor InteractableEdge() { return Hex(0x31, 0x5B, 0x57); }
	inline FLinearColor PlayerThread() { return Hex(0x66, 0x76, 0xB8); }
	inline FLinearColor Health() { return Hex(0xB8, 0x4F, 0x49); }
	inline FLinearColor Danger() { return Hex(0xE1, 0x6A, 0x54); }
	inline FLinearColor Hazard() { return Hex(0x9A, 0x8D, 0x42); }
	inline FLinearColor Interact() { return Hex(0x5B, 0x94, 0x86); }
	inline FLinearColor Rare() { return Hex(0x59, 0x7D, 0xA2); }
	inline FLinearColor Exceptional() { return Hex(0x86, 0x67, 0xA3); }
	inline FLinearColor HighValue() { return Hex(0xC0, 0x9A, 0x50); }
	/** Damage numbers: normal paper white, crits ochre. */
	inline FLinearColor PaperWhite() { return Hex(0xF2, 0xEC, 0xDE); }
	inline FLinearColor Ochre() { return Hex(0xC8, 0x8A, 0x2E); }

	inline FLinearColor RarityColor(EEnderLootRarity R)
	{
		switch (R)
		{
		case EEnderLootRarity::Rare: return Rare();
		case EEnderLootRarity::Exceptional: return Exceptional();
		case EEnderLootRarity::HighValue: return HighValue();
		default: return PaperWhite();
		}
	}
}

namespace EnderHudLayout
{
	constexpr float ReferenceWidth = 1920.f;
	constexpr float ReferenceHeight = 1080.f;
	/** Bottom-centre skill bar: six 58×58 icons, 7 px apart; Evade 46×46. */
	constexpr float SkillIconSize = 58.f;
	constexpr float SkillIconGap = 7.f;
	constexpr int32 SkillCount = 6;
	constexpr float EvadeIconSize = 46.f;
	/** Minimap top-left. */
	constexpr float MinimapSize = 180.f;
	/** Pinned contract top-right, at most two lines. */
	constexpr int32 PinnedContractMaxLines = 2;
	/** Familiar interpretation during Attunement, at most two lines; the reveal lasts 0.8 s. */
	constexpr int32 FamiliarMaxLines = 2;
	constexpr float AttunementRevealSeconds = 0.8f;

	inline float SkillBarWidth() { return SkillCount * SkillIconSize + (SkillCount - 1) * SkillIconGap; }
}
