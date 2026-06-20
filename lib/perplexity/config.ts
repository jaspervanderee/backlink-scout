export type PerplexityConfig = {
  apiKey: string;
  baseUrl: string;
};

const DEFAULT_PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

export function getPerplexityConfig(): PerplexityConfig | null {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl:
      process.env.PERPLEXITY_BASE_URL?.trim() || DEFAULT_PERPLEXITY_BASE_URL,
  };
}
