import { FOES, type FoeKind } from "@ender/battle";
import { foeSpec } from "../../art/ondevice/specs";
import { usePainted } from "../../art/ondevice/store";
import { foeWhere, useHeroArt } from "../../art/ondevice/useArt";
import { heroFigure } from "../../game/hero";
import { useStore } from "../../state/store";
import { Head } from "./Figure";

/** The hero's portrait: their on-device paint once it's in, else their drawn look. */
export function HeroHead({ size }: { size: number }) {
  const hero = useStore((s) => s.hero);
  const art = useHeroArt();
  return <Head figure={heroFigure(hero?.root ?? "iron")} look={hero?.look} size={size} art={art} />;
}

/** A foe's portrait as met at a map stop: painted on this device for that stop when ready, else the shared art. */
export function FoeHead({ kind, nodeId, size }: { kind: string; nodeId: string; size: number }) {
  const art = usePainted(foeSpec(kind, foeWhere(nodeId)), 1);
  return <Head figure={FOES[kind as FoeKind]?.figure ?? kind} size={size} art={art} />;
}
