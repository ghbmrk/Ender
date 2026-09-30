import type { Affinity, Role } from "@ender/battle";
import { P } from "../art/palette";

/** One pigment per Affinity, used for node rims, painted links and action cards. */
export const AFF_COLOR: Record<Affinity, string> = {
  burden: P.ember[2],
  veil: P.violet[3],
  reach: P.sapphire[3],
  knots: P.gold[3],
  flex: P.verdigris[3],
  bond: P.oxblood[3],
};
export const AFF_DEEP: Record<Affinity, string> = {
  burden: P.ember[1],
  veil: P.violet[1],
  reach: P.sapphire[1],
  knots: P.gold[1],
  flex: P.verdigris[1],
  bond: P.oxblood[1],
};
export const AFF_GLYPH: Record<Affinity, string> = { burden: "⛰", veil: "◐", reach: "➶", knots: "∞", flex: "≈", bond: "❦" };
export const ROLE_GLYPH: Record<Role, string> = { action: "⚔", modifier: "✦", reaction: "⛨", keystone: "◈" };
export const ROLE_NAME: Record<Role, string> = { action: "Action", modifier: "Modifier", reaction: "Reaction", keystone: "Keystone" };
