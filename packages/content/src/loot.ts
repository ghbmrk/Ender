export type CurrencyId = "merchants-rumor" | "broken-seal" | "wild-sigil" | "royal-writ";
export const CURRENCIES: Record<CurrencyId, { name: string; description: string }> = {
  "merchants-rumor": { name: "Merchant's Rumor", description: "Reveals which Essence will grow scarcer at the next turning." },
  "broken-seal": { name: "Broken Seal", description: "The next Mirror costs 1 less Focus." },
  "wild-sigil": { name: "Wild Sigil", description: "The next Temper leans hard toward exploration." },
  "royal-writ": { name: "Royal Writ", description: "Summons an extra Royal Contract at the Bazaar." },
};
