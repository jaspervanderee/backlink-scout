import type { FetchAndExtractResult } from "@/lib/fetch-and-extract";
import { getLlmClient } from "@/lib/llm";
import { BRIEF_SYSTEM_PROMPT, buildBriefUserPrompt } from "./prompt";
import type { GenerateBriefResult } from "./types";

function hasUsableExtractionContent(extraction: FetchAndExtractResult): boolean {
  if (extraction.metadata) {
    const { title, description } = extraction.metadata;
    if (title?.trim() || description?.trim()) {
      return true;
    }
  }

  const content = extraction.ok
    ? extraction.contentMarkdown || extraction.contentText
    : extraction.contentMarkdown ?? extraction.contentText;

  return Boolean(content?.trim());
}

async function callBriefLlm(
  extraction: FetchAndExtractResult,
): Promise<string> {
  const client = getLlmClient();
  if (!client) {
    throw new Error("config_missing");
  }

  const result = await client.completeText(
    [
      { role: "system", content: BRIEF_SYSTEM_PROMPT },
      { role: "user", content: buildBriefUserPrompt(extraction) },
    ],
    { temperature: 0.3, maxTokens: 4096 },
  );

  return result.content.trim();
}

export async function generateProspectingBrief(
  extraction: FetchAndExtractResult,
): Promise<GenerateBriefResult> {
  if (!hasUsableExtractionContent(extraction)) {
    return {
      ok: false,
      reason: "extraction_failed",
      message: extraction.ok
        ? "Could not extract enough content from this page to write a brief."
        : extraction.message,
    };
  }

  try {
    let brief = await callBriefLlm(extraction);

    if (!brief) {
      brief = await callBriefLlm(extraction);
    }

    if (!brief) {
      return {
        ok: false,
        reason: "llm_failed",
        message: "The brief could not be generated. Try again.",
      };
    }

    return { ok: true, brief };
  } catch (error) {
    if (error instanceof Error && error.message === "config_missing") {
      return {
        ok: false,
        reason: "config_missing",
        message: "LLM is not configured. Add JUDGMENT_LLM_API_KEY to .env.local.",
      };
    }

    try {
      const brief = await callBriefLlm(extraction);
      if (brief) {
        return { ok: true, brief };
      }
    } catch {
      // Fall through to error response below.
    }

    return {
      ok: false,
      reason: "llm_failed",
      message:
        error instanceof Error
          ? error.message
          : "The brief could not be generated. Try again.",
    };
  }
}
