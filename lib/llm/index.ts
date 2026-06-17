import { getLlmConfig } from "./config";
import { createDeepSeekClient } from "./deepseek";
import type { LlmClient } from "./types";

export type { LlmClient, LlmCompletionOptions, LlmMessage } from "./types";
export { getLlmConfig } from "./config";

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
