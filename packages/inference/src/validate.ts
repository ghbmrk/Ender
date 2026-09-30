import { RESULT_SCHEMAS, type InferenceKind } from "./types";
import { requestHash } from "./hash";

/** Collect every number that appears anywhere in a request (rounded both ways). */
function requestNumbers(request: unknown): Set<number> {
  const out = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === "number") {
      out.add(Math.round(v));
      out.add(Math.floor(v));
      out.add(Math.ceil(v));
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(request);
  return out;
}

/** Free-text fields only: IDs and enum values are checked structurally, not for numbers. */
const NON_TEXT_KEYS = new Set(["candidateId", "quality", "essence", "emphasis", "significance", "suggestedAction", "kind", "verdict"]);
function texts(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => texts(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!NON_TEXT_KEYS.has(k)) texts(x, out);
  return out;
}

/**
 * A fixture is valid when: its result matches the schema, its hash matches the
 * request, every referenced ID exists in the request, and every number in its
 * text also appears in the request (fixtures may not invent numeric facts).
 */
export function validateFixture(kind: InferenceKind, request: unknown, fixture: { requestHash: string; result: unknown }): string[] {
  const errors: string[] = [];
  const expected = requestHash(kind, request);
  if (fixture.requestHash !== expected) errors.push(`hash mismatch: fixture ${fixture.requestHash} vs request ${expected}`);
  const parsed = RESULT_SCHEMAS[kind].safeParse(fixture.result);
  if (!parsed.success) {
    errors.push(`schema: ${parsed.error.message}`);
    return errors;
  }
  if (kind === "transform") {
    const ids = new Set(((request as { candidates: { candidateId: string }[] }).candidates ?? []).map((c) => c.candidateId));
    for (const c of (parsed.data as { choices: { candidateId: string }[] }).choices) {
      if (!ids.has(c.candidateId)) errors.push(`invented candidate id ${c.candidateId}`);
    }
  }
  const nums = requestNumbers(request);
  for (const t of texts(parsed.data)) {
    for (const m of t.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?(?![\w])/g)) {
      const n = Number(m[0]);
      if (!nums.has(Math.round(n)) && !nums.has(n)) errors.push(`number ${m[0]} in "${t}" not found in request`);
    }
  }
  return errors;
}
