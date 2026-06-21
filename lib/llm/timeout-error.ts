export class LlmTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${ timeoutMs }ms.`);
    this.name = "LlmTimeoutError";
  }
}
