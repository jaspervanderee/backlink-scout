import type { LlmClient, LlmCompletionOptions, LlmMessage } from "./types.ts";
import type { LlmConfig } from "./config.ts";
import { LlmEmptyResponseError } from "./empty-response-error.ts";
import { LlmTimeoutError } from "./timeout-error.ts";
import { LlmTruncatedResponseError } from "./truncated-response-error.ts";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
};

async function requestCompletion(
  config: LlmConfig,
  messages: LlmMessage[],
  options: LlmCompletionOptions,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(`${ config.baseUrl }/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ config.apiKey }`,
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
        `LLM request failed with status ${ response.status }`,
    );
  }

  const choice = payload.choices?.[0];
  const content = choice?.message?.content?.trim();
  const finishReason = choice?.finish_reason ?? "unknown";

  if (!content) {
    console.error(
      `[llm] Empty response from ${ config.model } (finish_reason=${ finishReason })`,
    );
    throw new LlmEmptyResponseError();
  }

  if (finishReason === "length") {
    console.error(
      `[llm] Truncated response from ${ config.model } (${ content.length } chars, finish_reason=length)`,
    );
    throw new LlmTruncatedResponseError();
  }

  return content;
}

export function createDeepSeekClient(config: LlmConfig): LlmClient {
  return {
    async completeText(messages, options = {}) {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;

      if (options.timeoutMs && options.timeoutMs > 0) {
        timeout = setTimeout(() => controller.abort(), options.timeoutMs);
      }

      const maxTokens = options.maxTokens ?? 4096;

      try {
        try {
          return {
            content: await requestCompletion(
              config,
              messages,
              options,
              controller.signal,
            ),
          };
        } catch (error) {
          if (error instanceof LlmEmptyResponseError) {
            console.error("[llm] Retrying once after empty response.");
            return {
              content: await requestCompletion(
                config,
                messages,
                options,
                controller.signal,
              ),
            };
          }

          if (error instanceof LlmTruncatedResponseError) {
            const boostedMaxTokens = Math.min(maxTokens * 2, 16_384);
            if (boostedMaxTokens > maxTokens) {
              console.error(
                `[llm] Retrying once with max_tokens=${ boostedMaxTokens } after truncation.`,
              );
              return {
                content: await requestCompletion(
                  config,
                  messages,
                  { ...options, maxTokens: boostedMaxTokens },
                  controller.signal,
                ),
              };
            }
          }

          throw error;
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new LlmTimeoutError(options.timeoutMs ?? 0);
        }

        throw error;
      } finally {
        if (timeout) {
          clearTimeout(timeout);
        }
      }
    },
  };
}
