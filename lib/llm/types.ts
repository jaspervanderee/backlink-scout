export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmCompletionOptions = {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Request timeout in milliseconds. When omitted, no timeout is applied. */
  timeoutMs?: number;
};

export type LlmCompletionResult = {
  content: string;
};

export type LlmClient = {
  completeText(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
  ): Promise<LlmCompletionResult>;
};
