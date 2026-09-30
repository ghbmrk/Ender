import { canonicalize } from "@weave/shared";
import { requestHash } from "./hash";
import { RuleInferenceProvider } from "./rule";
import {
  DEFAULT_WU,
  RESULT_SCHEMAS,
  type AttuneRequest,
  type CritiqueRequest,
  type InferenceEnvelope,
  type InferenceKind,
  type InferenceProvider,
  type TransformRequest,
} from "./types";

export class FixtureRequired extends Error {
  constructor(
    readonly kind: InferenceKind,
    readonly hash: string,
    readonly requestPath: string,
  ) {
    super(`Inference fixture required: ${kind}/${hash} (request written to ${requestPath})`);
  }
}

export type FixtureFile<T = unknown> = {
  type: InferenceKind;
  requestHash: string;
  fixtureVersion: string;
  author: string;
  result: T;
  usage?: { workUnits: number };
};

/** Where fixtures live and missing requests go: the filesystem in Node, a bundled map in the browser. */
export interface FixtureStore {
  readFixture(kind: InferenceKind, hash: string): FixtureFile | undefined;
  hasRequest(kind: InferenceKind, hash: string): boolean;
  /** Returns where the request was recorded (for error messages). */
  recordRequest(kind: InferenceKind, hash: string, request: unknown): string;
  listMissing?(): { type: string; hash: string }[];
}

/** A read-only store over fixtures already in memory (e.g. bundled into the browser build). */
export function memoryFixtureStore(fixtures: FixtureFile[]): FixtureStore {
  const byKey = new Map(fixtures.map((f) => [`${f.type}/${f.requestHash}`, f]));
  return {
    readFixture: (kind, hash) => byKey.get(`${kind}/${hash}`),
    hasRequest: () => true,
    recordRequest: (kind, hash) => `${kind}/${hash} (not recorded in this build)`,
  };
}

export type FixtureProviderOptions = {
  store: FixtureStore;
  strict?: boolean;
  fallback?: InferenceProvider;
  /** Don't write missing requests (e.g. read-only test runs). */
  recordMissing?: boolean;
  /** Also record requests that already have a fixture (used by fixtures:collect). */
  recordAll?: boolean;
};

/**
 * request → canonicalize → SHA-256 → store (data/inference-fixtures/<type>/<hash>.json in Node).
 * Missing fixtures are recorded (data/inference-requests/<type>/<hash>.json) and either
 * throw (strict) or fall back to the RuleInferenceProvider.
 */
export class FixtureInferenceProvider implements InferenceProvider {
  readonly name = "fixture" as const;
  private fallback: InferenceProvider;
  readonly misses: { kind: InferenceKind; hash: string }[] = [];
  readonly hits: { kind: InferenceKind; hash: string }[] = [];
  /** The most recent requests, for the developer provenance view and E2E checks. */
  readonly recent: { kind: InferenceKind; hash: string; request: unknown; source: "fixture" | "fallback" }[] = [];
  private remember(kind: InferenceKind, hash: string, request: unknown, source: "fixture" | "fallback") {
    this.recent.unshift({ kind, hash, request: JSON.parse(canonicalize(request)), source });
    this.recent.length = Math.min(this.recent.length, 25);
  }

  constructor(private opts: FixtureProviderOptions) {
    this.fallback = opts.fallback ?? new RuleInferenceProvider();
  }

  private async run<T>(kind: InferenceKind, request: unknown, fallback: () => Promise<InferenceEnvelope<T>>): Promise<InferenceEnvelope<T>> {
    const hash = requestHash(kind, request);
    const store = this.opts.store;
    const record = () => (store.hasRequest(kind, hash) ? `${kind}/${hash}` : store.recordRequest(kind, hash, JSON.parse(canonicalize(request))));
    const file = store.readFixture(kind, hash) as FixtureFile<T> | undefined;
    if (file) {
      if (this.opts.recordAll) record();
      const parsed = RESULT_SCHEMAS[kind].safeParse(file.result);
      if (!parsed.success) throw new Error(`invalid fixture ${kind}/${hash}: ${parsed.error.message}`);
      this.hits.push({ kind, hash });
      this.remember(kind, hash, request, "fixture");
      return {
        result: parsed.data as T,
        usage: { workUnits: file.usage?.workUnits ?? DEFAULT_WU[kind] },
        provenance: { provider: "fixture", requestHash: hash, fixtureVersion: file.fixtureVersion },
      };
    }
    const where = this.opts.recordMissing !== false ? record() : `${kind}/${hash}`;
    this.misses.push({ kind, hash });
    this.remember(kind, hash, request, "fallback");
    if (this.opts.strict) throw new FixtureRequired(kind, hash, where);
    return fallback();
  }

  attune(r: AttuneRequest) {
    return this.run("attune", r, () => this.fallback.attune(r));
  }
  transform(r: TransformRequest) {
    return this.run("transform", r, () => this.fallback.transform(r));
  }
  critique(r: CritiqueRequest) {
    return this.run("critique", r, () => this.fallback.critique(r));
  }
}
