/**
 * Painted art (art/prompts.json → scripts/art-generate.py or uploads → scripts/art-ingest.py).
 * Each webp in ./painted is inlined into the single-file build as a data URL. Where a painted
 * image exists it replaces the code-drawn figure, backdrop or card art of the same id; where it
 * doesn't, the drawn art stays.
 */
const files = import.meta.glob("./painted/*.webp", { eager: true, query: "?inline", import: "default" }) as Record<string, string>;

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
