import type { InferenceProvider } from "./types";

/**
 * Future provider backed by a player's authorized ChatGPT plan.
 * Not implemented in the MVP and never selected: it exists only to pin the
 * boundary (attune / transform / critique + usage → Work Units).
 */
export class ChatGPTPlanInferenceProvider implements InferenceProvider {
  readonly name = "future-chatgpt" as const;
  async attune(): Promise<never> {
    throw new Error("ChatGPTPlanInferenceProvider is not implemented in the MVP");
  }
  async transform(): Promise<never> {
    throw new Error("ChatGPTPlanInferenceProvider is not implemented in the MVP");
  }
  async critique(): Promise<never> {
    throw new Error("ChatGPTPlanInferenceProvider is not implemented in the MVP");
  }
  async plan(): Promise<never> {
    throw new Error("ChatGPTPlanInferenceProvider is not implemented in the MVP");
  }
}
