import { createHash } from "node:crypto";
import { canonicalize } from "@weave/shared";
import type { InferenceKind } from "./types";

/** request → canonical JSON → SHA-256 (hex). */
export function requestHash(kind: InferenceKind, request: unknown): string {
  return createHash("sha256").update(`${kind}\n${canonicalize(request)}`).digest("hex");
}
