import { queryContainsDomain } from "./domain";
import type { LlmSearchPlan, LlmSearchQuery, SearchPlanPriority } from "./types";

const PRIORITIES: SearchPlanPriority[] = ["high", "medium", "low"];
const GENERIC_QUERY_PATTERNS = [
  /^best tools$/i,
  /^resources$/i,
  /^tools$/i,
  /^links$/i,
];
const SHOPPING_TOKENS = ["buy", "cheap", "for sale", "discount"];
const VAGUE_PAGE_TYPES = ["page", "website", "site", "web page"];
const EDITORIAL_CONTEXT_TOKENS = [
  "gift guide",
  "roundup",
  "editorial",
  "curated",
  "feature",
];

export type ValidateLlmSearchPlanResult =
  | { ok: true; plan: LlmSearchPlan; warnings: string[] }
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

function isPriority(value: unknown): value is SearchPlanPriority {
  return (
    typeof value === "string" &&
    PRIORITIES.includes(value as SearchPlanPriority)
  );
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function collectQueryWarnings(
  query: LlmSearchQuery,
  index: number,
  brief: string,
): string[] {
  const warnings: string[] = [];
  const label = `Query ${index + 1}`;

  if (wordCount(query.queryText) < 4 || GENERIC_QUERY_PATTERNS.some((pattern) => pattern.test(query.queryText.trim()))) {
    warnings.push(`${label}: query looks very short or vague.`);
  }

  if (query.rationale.trim().length < 20) {
    warnings.push(`${label}: rationale is thin.`);
  }

  const lowerRationale = query.rationale.toLowerCase();
  const hasShoppingIntent = SHOPPING_TOKENS.some((token) =>
    query.queryText.toLowerCase().includes(token),
  );
  const hasEditorialContext = EDITORIAL_CONTEXT_TOKENS.some((token) =>
    lowerRationale.includes(token),
  );
  if (hasShoppingIntent && !hasEditorialContext) {
    warnings.push(
      `${label}: query has shopping intent without clear editorial rationale.`,
    );
  }

  if (
    VAGUE_PAGE_TYPES.includes(query.expectedPageType.trim().toLowerCase())
  ) {
    warnings.push(`${label}: expected page type is vague.`);
  }

  const capitalizedPhrases = query.queryText.match(
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
  );
  if (capitalizedPhrases) {
    for (const phrase of capitalizedPhrases) {
      if (!brief.includes(phrase)) {
        warnings.push(
          `${label}: query may reference an invented brand or publication ("${phrase}").`,
        );
      }
    }
  }

  return warnings;
}

function validateQuery(
  raw: unknown,
  index: number,
  hypotheses: string[],
  projectDomain: string | null,
): string[] {
  const errors: string[] = [];
  const label = `Query ${index + 1}`;

  if (!raw || typeof raw !== "object") {
    return [`${label}: must be an object.`];
  }

  const query = raw as Record<string, unknown>;

  if (!isNonEmptyString(query.queryText)) {
    errors.push(`${label}: queryText is required.`);
  }
  if (!isNonEmptyString(query.hypothesisUsed)) {
    errors.push(`${label}: hypothesisUsed is required.`);
  } else if (!hypotheses.includes(query.hypothesisUsed.trim())) {
    errors.push(
      `${label}: hypothesisUsed must exactly match one opportunityHypotheses entry.`,
    );
  }
  if (!isPriority(query.priority)) {
    errors.push(`${label}: priority must be high, medium, or low.`);
  }
  if (!isNonEmptyString(query.rationale)) {
    errors.push(`${label}: rationale is required.`);
  }
  if (!isNonEmptyString(query.expectedPageType)) {
    errors.push(`${label}: expectedPageType is required.`);
  }
  if (!isNonEmptyString(query.riskNote)) {
    errors.push(`${label}: riskNote is required.`);
  }

  const count = query.recommendedResultCount;
  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 5 ||
    count > 10
  ) {
    errors.push(`${label}: recommendedResultCount must be an integer 5–10.`);
  }

  if (
    isNonEmptyString(query.queryText) &&
    projectDomain &&
    queryContainsDomain(query.queryText, projectDomain)
  ) {
    errors.push(`${label}: queryText must not contain the project domain.`);
  }

  return errors;
}

export function validateLlmSearchPlan(
  raw: unknown,
  projectDomain: string | null,
  brief: string,
): ValidateLlmSearchPlanResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["Root value must be a JSON object."] };
  }

  const value = raw as Record<string, unknown>;

  if (!value.metadata || typeof value.metadata !== "object") {
    errors.push("metadata is required.");
  } else {
    const metadata = value.metadata as Record<string, unknown>;

    if (!isNonEmptyString(metadata.projectCategory)) {
      errors.push("metadata.projectCategory is required.");
    }
    if (!isStringArray(metadata.targetAudiences)) {
      errors.push("metadata.targetAudiences must be a non-empty string array.");
    }
    if (!isNonEmptyString(metadata.searchLanguage)) {
      errors.push("metadata.searchLanguage is required.");
    }
    if (
      metadata.searchCountryRegion !== null &&
      metadata.searchCountryRegion !== undefined &&
      typeof metadata.searchCountryRegion !== "string"
    ) {
      errors.push("metadata.searchCountryRegion must be a string or null.");
    }
    if (!Array.isArray(metadata.excludedDomains)) {
      errors.push("metadata.excludedDomains must be an array.");
    }
    if (!Array.isArray(metadata.assumptions)) {
      errors.push("metadata.assumptions must be an array.");
    }
  }

  const hypotheses = Array.isArray(value.opportunityHypotheses)
    ? value.opportunityHypotheses.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];

  if (
    !Array.isArray(value.opportunityHypotheses) ||
    hypotheses.length < 4 ||
    hypotheses.length > 8
  ) {
    errors.push("opportunityHypotheses must contain 4–8 non-empty strings.");
  }

  if (!Array.isArray(value.queries)) {
    errors.push("queries must be an array.");
  } else if (value.queries.length < 8 || value.queries.length > 12) {
    errors.push("queries must contain 8–12 items.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const queryErrors: string[] = [];
  for (const [index, query] of (value.queries as unknown[]).entries()) {
    queryErrors.push(...validateQuery(query, index, hypotheses, projectDomain));
  }

  if (queryErrors.length > 0) {
    return { ok: false, errors: queryErrors };
  }

  const plan = value as unknown as LlmSearchPlan;
  plan.metadata.searchCountryRegion =
    plan.metadata.searchCountryRegion ?? null;

  const warnings = plan.queries.flatMap((query, index) =>
    collectQueryWarnings(query, index, brief),
  );

  return { ok: true, plan, warnings };
}
