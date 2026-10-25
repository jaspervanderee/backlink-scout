import { getLlmClient } from "@/lib/llm";
import type { SiteCheckSummary, SiteEvidence } from "@/lib/site-check/types";
import { readProfile } from "./profile";
import { PITCH_DRAFT_SYSTEM_PROMPT, buildPitchDraftUserPrompt } from "./prompt";
import { readPublication } from "./read-publication";
import { composePitchEmail, readPitchLinks, type PitchLinks } from "./template";
import type { PitchChannel, PitchDraft, PitchFormField } from "./types";

// Reasoning models spend part of this budget, and time, before any visible output.
const DRAFT_MAX_TOKENS = 8_192;
const DRAFT_TIMEOUT_MS = 120_000;
const MISSING_PROFILE = "No profile available.";
const FORM_ROUTE_PATTERN = /\b(form|upload)\b/i;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function readText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readFormFields(value: unknown): PitchFormField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({ label: readText(item, "label"), value: readText(item, "value") }))
    .filter((field) => field.label && field.value);
}

export function parsePitchDraft(raw: string, links: PitchLinks, channel: PitchChannel): PitchDraft {
  const record = JSON.parse(raw) as Record<string, unknown>;
  const to = readText(record, "to");
  const body = composePitchEmail(
    {
      greeting: readText(record, "greeting"),
      anchor: readText(record, "anchor"),
      project: readText(record, "project"),
      readers: readText(record, "readers"),
    },
    links,
  );

  return {
    siteName: readText(record, "siteName"),
    channel,
    to: to && to !== "null" ? to : null,
    subject: readText(record, "subject"),
    body,
    formFields: readFormFields(record.formFields),
  };
}

export async function draftPitch(
  projectContext: string,
  evidence: SiteEvidence,
  summary: SiteCheckSummary,
): Promise<PitchDraft> {
  const client = getLlmClient();
  if (!client) {
    throw new Error("LLM is not configured.");
  }

  const profile = readProfile() ?? MISSING_PROFILE;
  const reading = await readPublication(evidence, summary);
  const method = summary.submission.method;
  const channel: PitchChannel = FORM_ROUTE_PATTERN.test(method) && !method.includes("@") ? "form" : "email";
  const response = await client.completeText(
    [
      { role: "system", content: PITCH_DRAFT_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildPitchDraftUserPrompt(
          profile,
          projectContext,
          evidence,
          reading,
          summary,
          channel,
        ),
      },
    ],
    { temperature: 0.4, maxTokens: DRAFT_MAX_TOKENS, jsonMode: true, timeoutMs: DRAFT_TIMEOUT_MS },
  );

  const draft = parsePitchDraft(response.content, readPitchLinks(projectContext), channel);
  // Prefer the address the site check names for pitches; only ever use addresses found on their site.
  const methodAddress = (method.match(EMAIL_PATTERN) ?? [])
    .map((address) => address.toLowerCase())
    .find((address) => evidence.emails.includes(address));
  const writerAddress = draft.to && evidence.emails.includes(draft.to.toLowerCase()) ? draft.to : null;
  return { ...draft, to: channel === "form" ? null : methodAddress ?? writerAddress };
}
