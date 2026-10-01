/** Types for engine.js (plain JS so the standalone page can inline it). */
export type Manifest = { files: string[]; total: number; phrases: Record<string, string>; matte?: { json: string; bin: string }; [k: string]: unknown };
export type Gate = () => Promise<void>;
export type Painter = {
  paint(o: { traits: string[]; seed?: number; gate?: Gate | null }): Promise<{ rgba: Uint8ClampedArray; ms: { unet: number; decode: number; total: number } }>;
  matte(rgba: Uint8ClampedArray): Promise<Float32Array | null>;
  device: unknown;
  lost: Promise<unknown>;
  phrases: Record<string, string>;
  gpuName: string;
};
export function createPainter(o: {
  manifest: Manifest;
  fetchChunk: (file: string) => Promise<ArrayBuffer>;
  onProgress?: (p: number) => void;
  adapter?: unknown;
  gate?: Gate | null;
}): Promise<Painter>;
