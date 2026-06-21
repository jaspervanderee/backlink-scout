import type {
  DomainDecision,
  LlmReadPagesPlan,
  LlmSiteSearchPlan,
  OpportunityType,
  ReadPagesToolResult,
  SiteSearchToolResult,
} from "./types";
import { countSuccessfulReadPages } from "./read-pages";

const MIN_SITE_SEARCH_QUERY_CHARS = 12;
const MAX_SITE_SEARCH_QUERY_CHARS = 500;
const MAX_READ_PAGES = 5;

const DECISIONS = ["promising", "maybe", "skip"] as const;
const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
const OPPORTUNITY_TYPES: OpportunityType[] = [
  "existing_inclusion",
  "resource_listing",
  "roundup_guide",
  "editorial_feature",
  "newsletter_blog_pitch",
  "not_a_fit",
];

export type ValidateSiteSearchPlanResult =
  | { ok: true; plan: LlmSiteSearchPlan; warnings: string[] }
  | { ok: false; errors: string[] };

export type ValidateReadPagesPlanResult =
  | { ok: true; plan: LlmReadPagesPlan; warnings: string[] }
  | { ok: false; errors: string[] };

export type ValidateDomainDecisionResult =
  | { ok: true; decision: DomainDecision; warnings: string[] }
  | { ok: false; errors: string[] };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function isBasicUrl(value: string): boolean {
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${ value }`);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function isOpportunityType(value: unknown): value is OpportunityType {
  return (
    typeof value === "string" &&
    OPPORTUNITY_TYPES.includes(value as OpportunityType)
  );
}

export function validateSiteSearchPlan(
  value: unknown,
): ValidateSiteSearchPlanResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["Site search plan must be a JSON object."] };
  }

  const record = value as Record<string, unknown>;

  if ("skip" in record) {
    errors.push("site_search cannot be skipped. Provide a query.");
  }

  if (!isNonEmptyString(record.query)) {
    errors.push("Site search plan requires a non-empty query.");
  } else if (record.query.trim().length < MIN_SITE_SEARCH_QUERY_CHARS) {
    errors.push(
      `Site search query is too short. Use at least ${ MIN_SITE_SEARCH_QUERY_CHARS } characters.`,
    );
  } else if (record.query.trim().length > MAX_SITE_SEARCH_QUERY_CHARS) {
    errors.push("Site search query is too long.");
  }

  if (!isNonEmptyString(record.rationale)) {
    errors.push("Site search plan requires a rationale.");
  } else if (record.rationale.trim().length < 20) {
    warnings.push("Site search rationale is thin.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const query = record.query as string;
  const rationale = record.rationale as string;

  return {
    ok: true,
    plan: {
      query: query.trim(),
      rationale: rationale.trim(),
    },
    warnings,
  };
}

export function validateReadPagesPlan(value: unknown): ValidateReadPagesPlanResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["Read pages plan must be a JSON object."] };
  }

  const record = value as Record<string, unknown>;

  if (!isStringArray(record.urls)) {
    errors.push("Read pages plan requires a non-empty urls array.");
  } else {
    if (record.urls.length > MAX_READ_PAGES) {
      errors.push(`Read pages plan allows at most ${ MAX_READ_PAGES } URLs.`);
    }

    for (const url of record.urls) {
      if (!isBasicUrl(url)) {
        errors.push(`Invalid URL in read pages plan: ${ url }`);
      }
    }
  }

  if (!isNonEmptyString(record.rationale)) {
    errors.push("Read pages plan requires a rationale.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const urls = record.urls as string[];
  const rationale = record.rationale as string;

  return {
    ok: true,
    plan: {
      urls: urls.map((url) => url.trim()),
      rationale: rationale.trim(),
    },
    warnings,
  };
}

function countStrongSiteSearchEvidence(siteSearch: SiteSearchToolResult): number {
  return siteSearch.evidence.filter((item) => item.snippet.trim().length > 0)
    .length;
}

export function validateDomainDecision(
  value: unknown,
  expectedDomain: string,
  siteSearch: SiteSearchToolResult | null,
  readPages: ReadPagesToolResult | null,
): ValidateDomainDecisionResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["Domain decision must be a JSON object."] };
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.domain)) {
    errors.push("Decision requires domain.");
  } else if (
    record.domain.trim().toLowerCase() !== expectedDomain.toLowerCase()
  ) {
    errors.push("Decision domain does not match the investigated domain.");
  }

  if (
    typeof record.decision !== "string" ||
    !DECISIONS.includes(record.decision as (typeof DECISIONS)[number])
  ) {
    errors.push("Decision must be promising, maybe, or skip.");
  }

  if (!isOpportunityType(record.opportunityType)) {
    errors.push("Decision requires a valid opportunityType.");
  }

  if (
    typeof record.confidence !== "string" ||
    !CONFIDENCE_LEVELS.includes(
      record.confidence as (typeof CONFIDENCE_LEVELS)[number],
    )
  ) {
    errors.push("Decision requires confidence: high, medium, or low.");
  }

  const requiredTextFields = [
    "externalFeatureEvidence",
    "fitRationale",
    "incentivesOrConflicts",
    "riskNotes",
    "suggestedOutreachAngle",
    "evidenceGaps",
    "toolTraceSummary",
  ] as const;

  for (const field of requiredTextFields) {
    if (!isNonEmptyString(record[field])) {
      errors.push(`Decision requires ${ field }.`);
    }
  }

  if (!isStringArray(record.evidencePagesInspected)) {
    errors.push("Decision requires evidencePagesInspected as a string array.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const decision = record.decision as DomainDecision["decision"];
  const confidence = record.confidence as DomainDecision["confidence"];
  const successfulReads = readPages ? countSuccessfulReadPages(readPages) : 0;
  const strongSiteEvidence = siteSearch
    ? countStrongSiteSearchEvidence(siteSearch)
    : 0;

  if (decision === "promising" && confidence === "high") {
    const hasStrongReadEvidence = successfulReads > 0;
    const hasStrongSearchEvidence = strongSiteEvidence >= 2;

    if (!hasStrongReadEvidence && !hasStrongSearchEvidence) {
      errors.push(
        "High-confidence promising requires successful page reads or at least two strong site_search evidence items.",
      );
    }
  }

  if (successfulReads === 0 && strongSiteEvidence === 0 && confidence === "high") {
    warnings.push(
      "High confidence with weak tool evidence — consider lowering confidence.",
    );
  }

  return {
    ok: true,
    decision: {
      domain: (record.domain as string).trim(),
      decision,
      opportunityType: record.opportunityType as OpportunityType,
      externalFeatureEvidence: (
        record.externalFeatureEvidence as string
      ).trim(),
      evidencePagesInspected: (record.evidencePagesInspected as string[]).map(
        (url) => url.trim(),
      ),
      fitRationale: (record.fitRationale as string).trim(),
      incentivesOrConflicts: (record.incentivesOrConflicts as string).trim(),
      riskNotes: (record.riskNotes as string).trim(),
      suggestedOutreachAngle: (record.suggestedOutreachAngle as string).trim(),
      confidence,
      evidenceGaps: (record.evidenceGaps as string).trim(),
      toolTraceSummary: (record.toolTraceSummary as string).trim(),
    },
    warnings,
  };
}
