export class LlmTruncatedResponseError extends Error {
  constructor() {
    super("LLM response was truncated before completion.");
    this.name = "LlmTruncatedResponseError";
  }
}
