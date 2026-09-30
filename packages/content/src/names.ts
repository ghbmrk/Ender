// Fantasy naming tables for Forms. Names are cosmetic and deterministic.
export const NAME_PREFIX = ["Ash", "Vel", "Mor", "Thren", "Isk", "Cal", "Oru", "Seph", "Dra", "Ny", "Hal", "Quor", "Lis", "Ven", "Ober", "Kest", "Umb", "Ryn", "Zeph", "Gal"];
export const NAME_SUFFIX = ["mere", "thal", "wyn", "gard", "esk", "oth", "ira", "und", "ael", "ovar", "ith", "ane", "rel", "os", "uin", "ek", "ara", "ond", "ise", "orn"];
export const FORM_NOUNS = ["Knot", "Lattice", "Seal", "Thread", "Crown", "Husk", "Lens", "Spindle", "Coil", "Sigil", "Veil", "Shard"];
export const QUALITY_NAMES = {
  burden: "Burden",
  veil: "Veil",
  reach: "Reach",
  knots: "Knots",
  flex: "Flex",
  bond: "Bond",
} as const;
export const QUALITY_DESCRIPTIONS = {
  burden: "How heavily the Form sits in the world.",
  veil: "How readily it hides in deep water.",
  reach: "How far its influence stretches outward.",
  knots: "How intricately it is tied.",
  flex: "How freely it twists.",
  bond: "How eagerly it grips other things.",
} as const;
