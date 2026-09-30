import type { ComponentType } from "react";
import type { FigureMeta, FigureProps } from "./types";

type FigureModule = { default: ComponentType<FigureProps>; meta: FigureMeta };
const mods = import.meta.glob<FigureModule>("./figures/*.tsx", { eager: true });

/** Every painted figure, by id (binder, warden, ranger, husk, wisp, hound, keeper, seer, swarm, king). */
export const FIGURES: Record<string, FigureModule> = Object.fromEntries(Object.values(mods).map((m) => [m.meta.id, m]));

export function figureFor(kind: string): FigureModule {
  return FIGURES[kind] ?? FIGURES.binder!;
}

type BackdropModule = { default: ComponentType<{ className?: string }>; STATIONS?: { id: string; x: number; y: number }[] };
const backs = import.meta.glob<BackdropModule>("./backdrops/*.tsx", { eager: true });
const byName = Object.fromEntries(Object.entries(backs).map(([path, m]) => [path.replace(/^.*\/(\w+)\.tsx$/, "$1"), m]));

/** Battle backdrop for a realm (the Throne for the King's hall). */
export function backdropFor(realmId: string, boss: boolean): BackdropModule | undefined {
  if (boss) return byName.Throne;
  return { "ashen-vault": byName.AshenVault, "glass-fen": byName.GlassFen, "hollow-keep": byName.HollowKeep }[realmId];
}
export const crossingBackdrop = () => byName.Crossing;
