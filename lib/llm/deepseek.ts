import type { LlmClient, LlmCompletionOptions, LlmMessage } from "./types";
import type { LlmConfig } from "./config";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function createDeepSeekClient(config: LlmConfig): LlmClient {
  return {
    async completeText(messages, options = {}) {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 4096,
          ...(options.jsonMode
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      });

      const payload = (await response.json()) as ChatCompletionResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ||
            `LLM request failed with status ${response.status}`,
        );
      }

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("LLM returned an empty response.");
      }

      return { content };
    },
  };
}
