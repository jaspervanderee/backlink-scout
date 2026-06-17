export type LlmConfig = {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
};

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export function getLlmConfig(): LlmConfig | null {
  const apiKey = process.env.JUDGMENT_LLM_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    provider: process.env.JUDGMENT_LLM_PROVIDER?.trim() || "deepseek",
    apiKey,
    model: process.env.JUDGMENT_LLM_MODEL?.trim() || "deepseek-chat",
    baseUrl:
      process.env.JUDGMENT_LLM_BASE_URL?.trim() || DEFAULT_DEEPSEEK_BASE_URL,
  };
}
