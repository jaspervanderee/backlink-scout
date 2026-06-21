import { assignQueryIds, extractHostname } from "./domain";
import {
  SEARCH_PLAN_SYSTEM_PROMPT,
  buildCorrectionUserPrompt,
  buildSearchPlanUserPrompt,
} from "./prompt";
import type { GenerateSearchPlanResult } from "./types";
import { validateLlmSearchPlan } from "./validate";
import { getLlmClient } from "@/lib/llm";
import { LlmEmptyResponseError } from "@/lib/llm/empty-response-error";
import { LlmTimeoutError } from "@/lib/llm/timeout-error";
import { LlmTruncatedResponseError } from "@/lib/llm/truncated-response-error";
import { SEARCH_PLAN_LLM_TIMEOUT_MS } from "@/lib/domain-investigation/config";

const SEARCH_PLAN_MAX_TOKENS = 8192;

async function callSearchPlanLlm(userPrompt: string): Promise<string> {
  const client = getLlmClient();
  if (!client) {
    throw new Error("config_missing");
  }

  const result = await client.completeText(
    [
      { role: "system", content: SEARCH_PLAN_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.4,
      maxTokens: SEARCH_PLAN_MAX_TOKENS,
      jsonMode: true,
      timeoutMs: SEARCH_PLAN_LLM_TIMEOUT_MS,
    },
  );

  return result.content.trim();
}

function parseJsonResponse(
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not parse JSON.";
    return { ok: false, error: message };
  }
}

function formatValidationMessage(errors: string[]): string {
  const joined = errors.join(" ");

  if (joined.includes("Unexpected end of JSON input")) {
    return "The search plan JSON was incomplete. Try again.";
  }

  return joined;
}

function isRetriableSearchPlanError(error: unknown): boolean {
  return (
    error instanceof LlmEmptyResponseError ||
    error instanceof LlmTruncatedResponseError ||
    error instanceof LlmTimeoutError
  );
}

async function generateValidatedPlan(
  brief: string,
  projectUrl: string,
): Promise<
  | { ok: true; plan: ReturnType<typeof assignQueryIds>; warnings: string[] }
  | { ok: false; reason: "llm_failed" | "validation_failed"; message: string }
> {
  const projectDomain = extractHostname(projectUrl);
  const userPrompt = buildSearchPlanUserPrompt(brief, projectUrl);

  let rawResponse: string;
  try {
    rawResponse = await callSearchPlanLlm(userPrompt);
  } catch (error) {
    if (isRetriableSearchPlanError(error)) {
      console.error("[search-plan] Retrying after retriable LLM error.");
      try {
        rawResponse = await callSearchPlanLlm(userPrompt);
      } catch (retryError) {
        const message =
          retryError instanceof Error
            ? retryError.message
            : "The search plan could not be generated. Try again.";
        return { ok: false, reason: "llm_failed", message };
      }
    } else {
      const message =
        error instanceof Error
          ? error.message
          : "The search plan could not be generated. Try again.";
      return { ok: false, reason: "llm_failed", message };
    }
  }

  if (!rawResponse) {
    return {
      ok: false,
      reason: "llm_failed",
      message: "The search plan could not be generated. Try again.",
    };
  }

  let parsed = parseJsonResponse(rawResponse);
  let validation = parsed.ok
    ? validateLlmSearchPlan(parsed.value, projectDomain, brief)
    : { ok: false as const, errors: [`Invalid JSON: ${ parsed.error }`] };

  if (!validation.ok && parsed.ok === false) {
    console.error("[search-plan] Invalid JSON on first pass, retrying generation.");
    try {
      rawResponse = await callSearchPlanLlm(userPrompt);
      parsed = parseJsonResponse(rawResponse);
      validation = parsed.ok
        ? validateLlmSearchPlan(parsed.value, projectDomain, brief)
        : { ok: false as const, errors: [`Invalid JSON: ${ parsed.error }`] };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The search plan could not be generated. Try again.";
      return { ok: false, reason: "llm_failed", message };
    }
  }

  if (!validation.ok) {
    const correctionResponse = await callSearchPlanLlm(
      buildCorrectionUserPrompt(
        brief,
        projectUrl,
        validation.errors,
        rawResponse,
      ),
    );

    if (!correctionResponse) {
      return {
        ok: false,
        reason: "validation_failed",
        message: formatValidationMessage(validation.errors),
      };
    }

    rawResponse = correctionResponse;
    parsed = parseJsonResponse(rawResponse);
    validation = parsed.ok
      ? validateLlmSearchPlan(parsed.value, projectDomain, brief)
      : { ok: false as const, errors: [`Invalid JSON: ${ parsed.error }`] };

    if (!validation.ok) {
      return {
        ok: false,
        reason: "validation_failed",
        message: formatValidationMessage(validation.errors),
      };
    }
  }

  return {
    ok: true,
    plan: assignQueryIds(validation.plan),
    warnings: validation.warnings,
  };
}

export async function generateSearchPlan(
  brief: string,
  projectUrl: string,
): Promise<GenerateSearchPlanResult> {
  const trimmedBrief = brief.trim();
  if (!trimmedBrief) {
    return {
      ok: false,
      reason: "brief_empty",
      message: "Enter a prospecting brief before continuing.",
    };
  }

  try {
    const result = await generateValidatedPlan(trimmedBrief, projectUrl);
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      plan: result.plan,
      warnings: result.warnings,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "config_missing") {
      return {
        ok: false,
        reason: "config_missing",
        message: "LLM is not configured. Add JUDGMENT_LLM_API_KEY to .env.local.",
      };
    }

    return {
      ok: false,
      reason: "llm_failed",
      message:
        error instanceof Error
          ? error.message
          : "The search plan could not be generated. Try again.",
    };
  }
}
