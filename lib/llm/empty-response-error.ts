export class LlmEmptyResponseError extends Error {
  constructor() {
    super("LLM returned an empty response.");
    this.name = "LlmEmptyResponseError";
  }
}
