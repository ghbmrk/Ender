// Ender — PP_Ender_InkOutline (post-process material, Blendable Location: Before Tonemapping).
// Custom Depth + Custom Stencil outlines (§80). Stencil: 1 Player, 2 Enemy, 3 Elite, 4 Boss,
// 5 Interactable, 6 Valuable Loot. Widths at 1080p: Player 2.0, Enemy 1.5, Elite 2.0, Boss 2.5,
// Environment 0.8 px (depth/normal edges of everything without a stencil). Ink is never black.
//
// Custom node inputs:
//   float2 UV            ScreenPosition (ViewportUV)
//   float2 ViewSize      View Size
//   float3 SceneColor    SceneTexture:PostProcessInput0
//   float  SceneDepth    SceneTexture:SceneDepth at UV
// The graph must also contain SceneTexture:CustomDepth and SceneTexture:CustomStencil nodes
// (unused outputs are fine) so the engine binds them for SceneTextureLookup.
//
// IDs below are ESceneTextureId values; verify against Engine/Source/Runtime/Engine/Classes/
// Materials/MaterialExpressionSceneTexture.h in 5.8 before first use (they have been stable).
#define ENDER_PPI_SCENEDEPTH 1
#define ENDER_PPI_WORLDNORMAL 8
#define ENDER_PPI_CUSTOMDEPTH 13
#define ENDER_PPI_CUSTOMSTENCIL 25

float px = ViewSize.y / 1080.0; // widths are authored at 1080p
float2 texel = 1.0 / ViewSize;

// Custom nodes compile into a function body, so helpers live in a local struct.
struct FEnderInk
{
	float Stencil(float2 uv) { return SceneTextureLookup(uv, ENDER_PPI_CUSTOMSTENCIL, false).r; }
	float CDepth(float2 uv) { return SceneTextureLookup(uv, ENDER_PPI_CUSTOMDEPTH, false).r; }

	float WidthFor(float s)
	{
	    if (s > 5.5) return 2.0;  // valuable loot
	    if (s > 4.5) return 1.5;  // interactable
	    if (s > 3.5) return 2.5;  // boss
	    if (s > 2.5) return 2.0;  // elite
	    if (s > 1.5) return 1.5;  // enemy
	    if (s > 0.5) return 2.0;  // player
	    return 0.0;
	}

	float3 InkFor(float s)
	{
	    if (s > 4.5) return float3(0.0296, 0.1046, 0.0931);             // #315B57 interactable
	    if (s > 2.5 && s < 3.5) return float3(0.0887, 0.0307, 0.0307);  // #543131 elite
	    if (s > 0.5 && s < 1.5) return float3(0.0296, 0.0356, 0.1022);  // #30365A player edge accent
	    return float3(0.0176, 0.0152, 0.0232);                          // #24212A ink, never pure black
	}
};
FEnderInk K;

// Object outlines: sample a ring at the widest width; an edge is where the stencil changes
// and the nearer surface owns the line (so overlapping characters keep their own ink).
float centre = K.Stencil(UV);
float centreDepth = K.CDepth(UV);
float bestWidth = 0.0;
float bestStencil = 0.0;
[unroll] for (int i = 0; i < 8; ++i)
{
    float a = i * 0.78539816;
    float2 dir = float2(cos(a), sin(a));
    [unroll] for (int r = 1; r <= 3; ++r)
    {
        float2 uv = UV + dir * texel * px * r;
        float s = K.Stencil(uv);
        if (abs(s - centre) > 0.5)
        {
            float owner = (K.CDepth(uv) < centreDepth) ? s : centre;
            float w = K.WidthFor(owner);
            if (w * px >= r && w > bestWidth) { bestWidth = w; bestStencil = owner; }
        }
    }
}

// Environment lines: depth discontinuity + normal crease, 0.8 px, only where no stencil.
float envLine = 0.0;
if (centre < 0.5)
{
    float d0 = SceneDepth;
    float2 o = texel * max(0.8 * px, 1.0);
    float dx = SceneTextureLookup(UV + float2(o.x, 0), ENDER_PPI_SCENEDEPTH, false).r;
    float dy = SceneTextureLookup(UV + float2(0, o.y), ENDER_PPI_SCENEDEPTH, false).r;
    float3 n0 = SceneTextureLookup(UV, ENDER_PPI_WORLDNORMAL, false).rgb;
    float3 nx = SceneTextureLookup(UV + float2(o.x, 0), ENDER_PPI_WORLDNORMAL, false).rgb;
    float3 ny = SceneTextureLookup(UV + float2(0, o.y), ENDER_PPI_WORLDNORMAL, false).rgb;
    float depthEdge = saturate((abs(dx - d0) + abs(dy - d0)) / (d0 * 0.02));
    float normalEdge = saturate((2.0 - dot(n0, nx) - dot(n0, ny)) * 2.0);
    // Fade environment lines with distance so far geometry doesn't turn into hatching.
    envLine = max(depthEdge, normalEdge) * 0.8 * saturate(1.0 - d0 / 6000.0);
}

float objLine = bestWidth > 0.0 ? 1.0 : 0.0;
float3 ink = K.InkFor(objLine > 0.0 ? bestStencil : 0.0);
float coverage = max(objLine, envLine * 0.75);
// Ink sits in the paper: multiply toward the ink colour, never replace with black.
return lerp(SceneColor, SceneColor * 0.25 + ink, coverage);
