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
