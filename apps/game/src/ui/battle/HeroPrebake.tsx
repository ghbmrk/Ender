import { heroFigure } from "../../game/hero";
import { useStore } from "../../state/store";
import { Prebake } from "./Figure";

/** Bakes the player's hero ahead of the next fight (both poses), so entering it never waits on the paint texture. */
export function HeroPrebake() {
  const hero = useStore((s) => s.hero);
  if (!hero) return null;
  return <Prebake figures={[{ figure: heroFigure(hero.root), look: hero.look }]} />;
}
