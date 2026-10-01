/**
 * Painted art (art/prompts.json → scripts/art-generate.py or uploads → scripts/art-ingest.py).
 * Each webp in ./painted is a URL: inlined as a data URL in the single-file build, a separate file
 * (fetched only when shown) in the split build. Where a painted
 * image exists it replaces the code-drawn figure, backdrop or card art of the same id; where it
 * doesn't, the drawn art stays.
 */
const files = import.meta.glob("./painted/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const byId: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) byId[path.replace(/^.*\/(.+)\.webp$/, "$1")] = url;

/** A figure's painted cut-out (feet on the bottom edge), by figure id: "warden", "hound", … */
export const paintedFigure = (id: string): string | undefined => byId[id];
/** A painted 1080×1920 backdrop by realm or scene id: "ashen-vault", "throne", "crossing", "title". */
export const paintedBackdrop = (id: string): string | undefined => byId[`bg-${id}`];
/** Card art by affinity: "burden", "veil", … */
export const paintedCard = (affinity: string): string | undefined => byId[`card-${affinity}`];
export const paintedTexture = (id: string): string | undefined => byId[`tex-${id}`];
export const hasPaintedArt = () => Object.keys(byId).length > 0;

/**
 * Where the ground is in each fight backdrop, as a share of its height: the line a figure standing in the middle
 * distance (centre-right) would put its feet on. The duel lines this up with the foe's feet.
 */
export const BACKDROP_FLOOR: Record<string, number> = {
  "ashen-vault": 0.84,
  "fen-lair": 0.87,
  "glass-fen": 0.79,
  "hollow-keep": 0.85,
  throne: 0.84,
};

const decoded = new Set<string>();
/**
 * Decodes painted images ahead of the screen that shows them, one per idle moment, so opening that screen (or
 * tapping on it) never waits on a big image decode.
 */
export function predecode(urls: (string | undefined)[]) {
  const todo = urls.filter((u): u is string => !!u && !decoded.has(u));
  const next = () => {
    const u = todo.shift();
    if (!u) return;
    decoded.add(u);
    const img = new Image();
    img.src = u;
    void img.decode().catch(() => undefined).then(() => idle(next));
  };
  const idle = (f: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(() => f(), { timeout: 1500 }) : setTimeout(f, 200));
  idle(next);
}
