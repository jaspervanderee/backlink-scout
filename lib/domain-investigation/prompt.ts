import type {
  DomainInvestigationInput,
  ReadPagesToolResult,
  SiteSearchToolResult,
} from "./types";
import { getHomepageUrl } from "./build-input";

const MAX_CORRECTION_JSON_CHARS = 12_000;

export const SITE_SEARCH_PLAN_JSON_EXAMPLE = JSON.stringify(
  {
    query:
      "site:example.com (featured OR roundup OR resources OR interview OR showcase OR directory)",
    rationale:
      "Look for pages on this domain that list, feature, review, or recommend outside products, tools, creators, or resources.",
  },
  null,
  2,
);

export const READ_PAGES_PLAN_JSON_EXAMPLE = JSON.stringify(
  {
    urls: [
      "https://example.com/",
      "https://example.com/representative-page",
      "https://example.com/resources/roundup",
    ],
    rationale:
      "Read the homepage, the representative discovery hit, and the strongest same-domain evidence page from site_search.",
  },
  null,
  2,
);

export const DOMAIN_DECISION_JSON_EXAMPLE = JSON.stringify(
  {
    domain: "example.com",
    decision: "maybe",
    opportunityType: "roundup_guide",
    externalFeatureEvidence:
      "Describe observed behavior where this domain features or links to outside products, tools, creators, or resources.",
    evidencePagesInspected: [
      "https://example.com/",
      "https://example.com/resources/roundup",
    ],
    fitRationale:
      "Explain whether the confirmed brief plausibly fits this domain's external-feature behavior.",
    incentivesOrConflicts:
      "Note paid placements, self-promotion, marketplace behavior, or conflicts.",
    riskNotes: "Note spam, weak editorial standards, or uncertain backlink path.",
    suggestedOutreachAngle:
      "Suggest a concrete outreach angle if decision is promising or maybe.",
    confidence: "medium",
    evidenceGaps: "What evidence is still missing or weak.",
    toolTraceSummary:
      "Short summary of site_search and read_pages steps and issues.",
  },
  null,
  2,
);

export const SITE_SEARCH_PLAN_SYSTEM_PROMPT = `You plan one mandatory site_search investigation step for a domain candidate.

Your job is to craft a single domain-scoped search query that may surface pages where the domain features, lists, reviews, curates, interviews, showcases, recommends, or links to outside products, services, tools, creators, projects, examples, websites, or resources.

Rules:
- site_search is REQUIRED for every domain. Do not skip it. Do not return skip: true.
- The query must be specific enough to find external-feature behavior on the candidate domain.
- Prefer queries that combine site:domain with editorial/listing/feature intent terms.
- Use the confirmed brief and search context to choose relevant terms, but search only within the candidate domain.
- Return only valid JSON matching the example shape. No preamble, no markdown fences.`;

export const READ_PAGES_PLAN_SYSTEM_PROMPT = `You plan one read_pages investigation step for a domain candidate.

Your job is to choose up to 5 URLs to fetch and read. This is evidence gathering, not the final decision.

Rules:
- Usually include the representative URL, the domain homepage, and the most promising same-domain evidence URLs from site_search.
- Prefer same-domain pages that may show external-feature behavior.
- Do not choose more than 5 URLs.
- Return only valid JSON matching the example shape. No preamble, no markdown fences.`;

export const DOMAIN_DECISION_SYSTEM_PROMPT = `You make the final domain outreach judgment for one candidate.

You are not doing deterministic filtering. Use the confirmed brief, search context, site_search evidence, and read_pages content together.

Decision guidance:
- promising: clear evidence the domain features or links to outside products/services/tools/creators/projects/resources AND a plausible fit with the confirmed brief.
- maybe: some evidence or topical fit, but the backlink path or external-feature behavior is incomplete, weak, or uncertain.
- skip: no realistic outreach path, no relevant external-feature behavior, poor fit, strong conflict, spammy/marketplace behavior, or the domain mostly promotes itself.

Important:
- Do not judge from only a domain, representative URL, title, or snippet.
- If page extraction failed and there is no other strong evidence, do not use high confidence with a promising decision.
- opportunityType must be one of: existing_inclusion, resource_listing, roundup_guide, editorial_feature, newsletter_blog_pitch, not_a_fit
- confidence must be high, medium, or low
- Return only valid JSON matching the example shape. No preamble, no markdown fences.`;

function formatSearchQueryContext(input: DomainInvestigationInput): string {
  if (input.searchQueryContext.length === 0) {
    return "No matching search query context.";
  }

  return input.searchQueryContext
    .map((context) => {
      const hitLines = context.hits
        .map((hit) => {
          const datePart = hit.date ? ` date=${ hit.date }` : "";
          const updatedPart = hit.lastUpdated
            ? ` updated=${ hit.lastUpdated }`
            : "";
          return `  - rank ${ hit.resultRank + 1 }: ${ hit.title } | ${ hit.url }\n    snippet: ${ hit.snippet }${ datePart }${ updatedPart }`;
        })
        .join("\n");

      return `Query ${ context.queryId } (${ context.priority })
Text: ${ context.queryText }
Hypothesis: ${ context.hypothesisUsed }
Expected page type: ${ context.expectedPageType }
Rationale: ${ context.rationale }
Risk: ${ context.riskNote }
Hits:
${ hitLines || "  (none for this domain)" }`;
    })
    .join("\n\n");
}

function formatSiteSearchResult(siteSearch: SiteSearchToolResult): string {
  if (!siteSearch.ok) {
    return `site_search failed: ${ siteSearch.error ?? "unknown error" }
Query used: ${ siteSearch.searchQuery }`;
  }

  if (siteSearch.evidence.length === 0) {
    return `site_search returned no same-domain evidence.
Query used: ${ siteSearch.searchQuery }`;
  }

  const lines = siteSearch.evidence
    .map((item, index) => {
      const datePart = item.date ? ` date=${ item.date }` : "";
      const updatedPart = item.lastUpdated
        ? ` updated=${ item.lastUpdated }`
        : "";
      return `${ index + 1 }. ${ item.title } | ${ item.url }
   snippet: ${ item.snippet }${ datePart }${ updatedPart }`;
    })
    .join("\n");

  return `Query used: ${ siteSearch.searchQuery }
Evidence candidates:
${ lines }`;
}

function formatReadPagesResult(readPages: ReadPagesToolResult): string {
  return readPages.pages
    .map((page, index) => {
      const status = page.ok ? "ok" : `failed (${ page.reason ?? "unknown" })`;
      const title = page.metadata?.title ?? "(no title)";
      const contentPreview = page.contentText
        ? page.contentText.slice(0, 2_000)
        : "(no extracted content)";

      return `Page ${ index + 1 }: ${ page.requestedUrl }
Status: ${ status } | final=${ page.finalUrl ?? "n/a" } | code=${ page.statusCode ?? "n/a" }
Title: ${ title }
Content preview:
${ contentPreview }`;
    })
    .join("\n\n");
}

export function buildSiteSearchPlanUserPrompt(
  input: DomainInvestigationInput,
): string {
  const homepageUrl = getHomepageUrl(input.candidate.representativeUrl);

  return `Plan one mandatory site_search for this domain candidate.

Domain: ${ input.candidate.domain }
Representative URL: ${ input.candidate.representativeUrl }
Representative title: ${ input.candidate.representativeTitle }
Homepage hint: ${ homepageUrl ?? "unknown" }

Confirmed prospecting brief:
${ input.brief }

Search query context:
${ formatSearchQueryContext(input) }

Return JSON with this shape:
${ SITE_SEARCH_PLAN_JSON_EXAMPLE }`;
}

export function buildReadPagesPlanUserPrompt(
  input: DomainInvestigationInput,
  siteSearch: SiteSearchToolResult,
): string {
  const homepageUrl = getHomepageUrl(input.candidate.representativeUrl);

  return `Plan one read_pages call for this domain candidate.

Domain: ${ input.candidate.domain }
Representative URL: ${ input.candidate.representativeUrl }
Homepage hint: ${ homepageUrl ?? "unknown" }

Confirmed prospecting brief:
${ input.brief }

site_search results:
${ formatSiteSearchResult(siteSearch) }

Choose up to 5 URLs. Usually include representative URL, homepage, and strongest same-domain evidence URLs from site_search.

Return JSON with this shape:
${ READ_PAGES_PLAN_JSON_EXAMPLE }`;
}

export function buildDecisionUserPrompt(
  input: DomainInvestigationInput,
  siteSearch: SiteSearchToolResult,
  readPages: ReadPagesToolResult,
): string {
  return `Make the final domain judgment for this candidate.

Domain: ${ input.candidate.domain }
Representative URL: ${ input.candidate.representativeUrl }
Representative title: ${ input.candidate.representativeTitle }

Confirmed prospecting brief:
${ input.brief }

Search query context:
${ formatSearchQueryContext(input) }

site_search results:
${ formatSiteSearchResult(siteSearch) }

read_pages results:
${ formatReadPagesResult(readPages) }

Return JSON with this shape:
${ DOMAIN_DECISION_JSON_EXAMPLE }`;
}

export function buildDecisionCorrectionUserPrompt(
  input: DomainInvestigationInput,
  siteSearch: SiteSearchToolResult,
  readPages: ReadPagesToolResult,
  errors: string[],
  previousJson: string,
): string {
  const truncatedPrevious =
    previousJson.length > MAX_CORRECTION_JSON_CHARS
      ? `${ previousJson.slice(0, MAX_CORRECTION_JSON_CHARS) }\n\n[Truncated.]`
      : previousJson;

  const errorList = errors.map((error) => `- ${ error }`).join("\n");

  return `Your previous domain decision JSON failed validation. Fix all issues and return a corrected complete JSON object.

Domain: ${ input.candidate.domain }

Validation errors:
${ errorList }

Previous invalid JSON:
${ truncatedPrevious }

Context for correction:

Confirmed prospecting brief:
${ input.brief }

site_search results:
${ formatSiteSearchResult(siteSearch) }

read_pages results:
${ formatReadPagesResult(readPages) }

Return a corrected complete JSON object matching this shape (not a partial patch, not an explanation):
${ DOMAIN_DECISION_JSON_EXAMPLE }`;
}
