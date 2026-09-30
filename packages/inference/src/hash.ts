import { canonicalize, sha256Hex } from "@ender/shared";
import type { InferenceKind } from "./types";

/** request → canonical JSON → SHA-256 (hex). */
export function requestHash(kind: InferenceKind, request: unknown): string {
  return sha256Hex(`${kind}\n${canonicalize(request)}`);
}
