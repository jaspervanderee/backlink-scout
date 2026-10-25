import { getLlmClient } from "@/lib/llm";
import { draftPitch } from "@/lib/pitch-draft/draft-pitch";
import type { PitchDraft } from "@/lib/pitch-draft/types";
import { extractHostname } from "@/lib/search-plan/domain";
import { gatherSiteEvidence } from "./gather";
import { SITE_CHECK_SYSTEM_PROMPT, buildSiteCheckUserPrompt } from "./prompt";
import type {
  OutsideWorkAnswer,
  SiteCheckResult,
  SiteCheckSummary,
  SiteEvidence,
  SiteLean,
  SubmissionRequirements,
} from "./types";

const OUTSIDE_WORK_ANSWERS: OutsideWorkAnswer[] = ["yes", "rarely", "no", "unclear"];
const LEANS: SiteLean[] = ["good", "unsure", "poor"];
// Reasoning models spend part of this budget, and time, before any visible output.
const SUMMARY_MAX_TOKENS = 8_192;
const SUMMARY_TIMEOUT_MS = 120_000;

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function pickEnum<T extends string>(value: string, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readStringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSubmission(value: unknown): SubmissionRequirements {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    method: readString(record, "method"),
    materials: readStringList(record, "materials"),
    information: readStringList(record, "information"),
    rules: readStringList(record, "rules"),
    paidOnly: record.paidOnly === true,
  };
}

export function parseSiteCheckSummary(raw: string, evidence: SiteEvidence): SiteCheckSummary {
  const record = JSON.parse(raw) as Record<string, unknown>;
  const precedent = record.closestPrecedent as Record<string, unknown> | null | undefined;
  const precedentUrl = precedent ? readString(precedent, "url") : "";
  const precedentIsListed = [...evidence.posts, ...evidence.similarPosts]
    .some((post) => post.url === precedentUrl);
  const submission = parseSubmission(record.submission);

  return {
    topics: readString(record, "topics"),
    contentFormat: readString(record, "contentFormat"),
    featuresOutsideWork: pickEnum(readString(record, "featuresOutsideWork"), OUTSIDE_WORK_ANSWERS, "unclear"),
    featuresOutsideWorkNote: readString(record, "featuresOutsideWorkNote"),
    closestPrecedent:
      precedent && precedentIsListed
        ? { title: readString(precedent, "title"), url: precedentUrl, why: readString(precedent, "why") }
        : null,
    fitNote: readString(record, "fitNote"),
    angle: readString(record, "angle"),
    submission,
    lean: submission.paidOnly ? "poor" : pickEnum(readString(record, "lean"), LEANS, "unsure"),
    leanReason: readString(record, "leanReason"),
  };
}

export async function checkSite(
  domainInput: string,
  projectContext: string,
  now = new Date(),
): Promise<SiteCheckResult> {
  const domain = extractHostname(domainInput);
  if (!domain) {
    return { ok: false, reason: "invalid_domain", message: "Enter a valid domain." };
  }

  const client = getLlmClient();
  if (!client) {
    return {
      ok: false,
      reason: "config_missing",
      message: "LLM is not configured. Add JUDGMENT_LLM_API_KEY to .env.local.",
    };
  }

  const startedAt = Date.now();
  const evidence = await gatherSiteEvidence(domain, now);
  const today = now.toISOString().slice(0, 10);

  let summary: SiteCheckSummary;
  try {
    const response = await client.completeText(
      [
        { role: "system", content: SITE_CHECK_SYSTEM_PROMPT },
        { role: "user", content: buildSiteCheckUserPrompt(evidence, projectContext, today) },
      ],
      { temperature: 0.2, maxTokens: SUMMARY_MAX_TOKENS, jsonMode: true, timeoutMs: SUMMARY_TIMEOUT_MS },
    );
    summary = parseSiteCheckSummary(response.content, evidence);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Site check summary failed.";

    return {
      ok: true,
      check: { domain, evidence, summary: null, draft: null, error: message, durationMs: Date.now() - startedAt },
    };
  }

  let draft: PitchDraft | null = null;
  let error: string | null = null;
  if (summary.lean !== "poor") {
    try {
      draft = await draftPitch(projectContext, evidence, summary);
    } catch (draftError) {
      const reason = draftError instanceof Error ? draftError.message : "unknown error";
      error = `Draft failed: ${ reason }`;
    }
  }

  return {
    ok: true,
    check: { domain, evidence, summary, draft, error, durationMs: Date.now() - startedAt },
  };
}
