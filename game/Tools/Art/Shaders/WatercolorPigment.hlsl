// Ender — M_Ender_Watercolor_Master pigment body (Custom node, docs/ART_SPEC.md §Materials).
//
// Custom node inputs (all world-space, so nothing swims with the camera):
//   float3 BasePigment      linear colour
//   float3 WorldPos         Absolute World Position (camera-relative off)
//   float3 WorldNormal      PixelNormalWS
//   float3 CameraVector     CameraVectorWS
//   float  Paper            T_PaperGrain sampled with world-aligned (triplanar) UVs × PaperScale
//   float  PigmentVariance  0..1 (1 = the spec's full ±5% brightness / ±7% saturation)
//   float  EdgePooling      0..1 (1 = full 8% darkening at silhouettes and creases)
//   float  Granulation      0..1
//   float  Wetness          0..1 (softens variation, raises pooling slightly)
//   float  Cavity           0..1 from vertex colour R or AO (1 = crease)
// Output: float3 albedo. Lighting stays continuous: this only shapes albedo, never N·L bands.

// Custom nodes compile into a function body, so helpers live in a local struct.
struct FEnderPigment
{
	float Hash31(float3 p)
	{
	    p = frac(p * 0.1031);
	    p += dot(p, p.yzx + 33.33);
	    return frac((p.x + p.y) * p.z);
	}

	float ValueNoise3(float3 p)
	{
	    float3 i = floor(p);
	    float3 f = frac(p);
	    f = f * f * (3.0 - 2.0 * f);
	    float n000 = Hash31(i), n100 = Hash31(i + float3(1, 0, 0));
	    float n010 = Hash31(i + float3(0, 1, 0)), n110 = Hash31(i + float3(1, 1, 0));
	    float n001 = Hash31(i + float3(0, 0, 1)), n101 = Hash31(i + float3(1, 0, 1));
	    float n011 = Hash31(i + float3(0, 1, 1)), n111 = Hash31(i + float3(1, 1, 1));
	    float nx00 = lerp(n000, n100, f.x), nx10 = lerp(n010, n110, f.x);
	    float nx01 = lerp(n001, n101, f.x), nx11 = lerp(n011, n111, f.x);
	    return lerp(lerp(nx00, nx10, f.y), lerp(nx01, nx11, f.y), f.z) * 2.0 - 1.0; // [-1, 1]
	}
};
FEnderPigment P;

// Two octaves (§79): broad wash at ~1.8 m, finer bloom at ~45 cm.
float oct1 = P.ValueNoise3(WorldPos / 180.0);
float oct2 = P.ValueNoise3(WorldPos / 45.0 + 17.0);
float wash = 0.65 * oct1 + 0.35 * oct2; // [-1, 1]
float calm = lerp(1.0, 0.6, Wetness);

// Brightness ±5%, saturation ±7% at PigmentVariance = 1.
float brightness = 1.0 + 0.05 * wash * PigmentVariance * calm;
float satOct = 0.6 * P.ValueNoise3(WorldPos / 120.0 + 5.0) + 0.4 * P.ValueNoise3(WorldPos / 30.0 - 9.0);
float saturation = 1.0 + 0.07 * satOct * PigmentVariance * calm;

float luma = dot(BasePigment, float3(0.2126, 0.7152, 0.0722));
float3 col = lerp(luma.xxx, BasePigment, saturation) * brightness;

// Paper grain: the texture encodes ±0.055 around 0.5 (see generate_paper_grain.py).
col *= 1.0 + (Paper - 0.5) * 2.0 * 0.055;

// Granulation: pigment settles into paper tooth, darker where the grain is low.
float tooth = saturate(0.5 - Paper) * 2.0;
col *= 1.0 - 0.04 * Granulation * tooth;

// Edge pooling: pigment collects at silhouettes and creases, max 8% darkening (§79).
float rim = pow(1.0 - saturate(abs(dot(normalize(WorldNormal), normalize(CameraVector)))), 3.0);
float pool = saturate(max(rim, Cavity)) * EdgePooling * lerp(1.0, 1.15, Wetness);
col *= 1.0 - 0.08 * saturate(pool);

return max(col, 0.0);
