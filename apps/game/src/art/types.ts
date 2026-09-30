import type { HeroLook } from "./look";

export type Pose = "idle" | "strike";

export type FigureProps = {
  /** Override the viewBox, e.g. to crop a head portrait from the full figure. */
  viewBox?: string;
  className?: string;
  pose?: Pose;
  /** The player's hero look (hero figures only): colours, headwear, hair, build and emblem. Absent = the default drawing. */
  look?: HeroLook;
};

export type FigureMeta = {
  id: string;
  /** Full-figure viewBox [x, y, w, h]. */
  viewBox: [number, number, number, number];
  /** Where the feet (or hover point) meet the ground, in viewBox units. */
  feet: { x: number; y: number };
  /** Square crop around the head/face for turn-order portraits [x, y, size, size]. */
  head: [number, number, number, number];
  facing: "left" | "right";
};
