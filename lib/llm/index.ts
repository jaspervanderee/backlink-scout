import { getLlmConfig } from "./config.ts";
import { createDeepSeekClient } from "./deepseek.ts";
import type { LlmClient } from "./types.ts";

export type { LlmClient, LlmCompletionOptions, LlmMessage } from "./types.ts";
export { getLlmConfig } from "./config.ts";

export function getLlmClient(): LlmClient | null {
  const config = getLlmConfig();
  if (!config) {
    return null;
  }

  if (config.provider === "deepseek") {
    return createDeepSeekClient(config);
  }

  throw new Error(`Unsupported LLM provider: ${config.provider}`);
}
