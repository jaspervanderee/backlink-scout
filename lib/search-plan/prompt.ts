const MAX_CORRECTION_JSON_CHARS = 12_000;

const EXAMPLE_QUERY_TEXT = "[niche] blog [topic] feature";

const EXAMPLE_HYPOTHESES = [
  "Direct topical opportunity: why sites in the project's core subject area might feature or link to it.",
  "Broader editorial-fit opportunity: design or culture sites might feature this for visual, aesthetic, or cultural relevance.",
  "Broader editorial-fit opportunity: maker, creator, or product-discovery sites might feature this for usefulness or novelty.",
  "Broader editorial-fit opportunity: gift guides, newsletters, or curator roundups might include this as a distinctive find.",
] as const;

function buildExampleQuery(hypothesisUsed: string, index: number) {
  const priority: "high" | "medium" | "low" =
    index <= 2 ? "high" : index <= 5 ? "medium" : "low";

  return {
    queryText: EXAMPLE_QUERY_TEXT,
    hypothesisUsed,
    priority,
    rationale: "why this query could surface pages that publish or feature external work",
    expectedPageType: "feature, roundup, case study, review, or curated list",
    riskNote: "what could go wrong or produce noise",
    recommendedResultCount: 8,
  };
}

export const SEARCH_PLAN_JSON_EXAMPLE = JSON.stringify(
  {
    metadata: {
      projectCategory: "string",
      targetAudiences: ["string"],
      searchLanguage: "string",
      searchCountryRegion: "string or null",
      excludedDomains: ["example.com"],
      assumptions: ["string"],
    },
    opportunityHypotheses: [...EXAMPLE_HYPOTHESES],
    queries: EXAMPLE_HYPOTHESES.flatMap((hypothesis, hypothesisIndex) =>
      [1, 2].map((offset) =>
        buildExampleQuery(hypothesis, hypothesisIndex * 2 + offset),
      ),
    ),
  },
  null,
  2,
);

export const SEARCH_PLAN_SYSTEM_PROMPT = `You are a backlink prospecting strategist. Read the confirmed brief and produce a search query plan for domains that feature unaffiliated third-party work for free (blogs, magazines, newsletters, roundups, gift guides, resource lists, directories, interviews, case studies).

Generate queries for publisher/editorial surfaces — not customer-shopping queries and not queries that only describe the asset or product itself.

Query formula: [audience / community / publisher world] + [brief-grounded topic hint] + [publisher / page format]

Good queryText examples (vary project types; do not copy verbatim):
- indie SaaS blog startup tool feature
- developer newsletter useful indie tools
- startup resources curated tools list
- gift guide design lover unique product
- maker blog case study side project

Bad queryText examples:
- colour gradient data visualization badge art
- infographic silhouette trophy
- independent artist print curated
- best cheap product buy
- room decor ideas

Rules:
- Infer 4–8 opportunityHypotheses mixing direct topical angles and broader editorial-fit angles (design, culture, makers, curators, newsletters). At least half should be editorial-world hypotheses, not all literal subject variants.
- Generate 8–12 queries; each references exactly one hypothesis via hypothesisUsed (exact string match).
- Do not make most queries start with the project/product noun — vary communities, publisher types, and page formats.
- Use discovery signals, adjacent categories, and brief vocabulary for homonym disambiguation when needed.
- Spread queries across hypotheses and page types; avoid near-duplicate SERPs.
- Use the brief as sole source of truth. Set excludedDomains to include the project domain. Do not invent publication or brand names unless grounded in the brief.
- priority: high | medium | low. recommendedResultCount: integer 5–10.
- Return only valid JSON matching the example shape. No preamble, no markdown fences.`;

export function buildSearchPlanUserPrompt(
  brief: string,
  projectUrl: string,
): string {
  return `Create a search query plan for this project.

Project URL: ${projectUrl}

Confirmed prospecting brief:
${brief.trim()}

Every queryText needs publisher/editorial intent — strong signals (blog, magazine, newsletter, roundup, gift guide, feature, case study, interview, curated list) or conditional signals (directory, resources, tools list, guide, review) when clearly publisher-facing. Do not copy the example queryText verbatim.

Return JSON with this shape (example shows minimum valid counts: 4 hypotheses, 8 queries; you may use up to 8 hypotheses and 12 queries):
${SEARCH_PLAN_JSON_EXAMPLE}`;
}

export function buildCorrectionUserPrompt(
  brief: string,
  projectUrl: string,
  errors: string[],
  previousJson: string,
): string {
  const truncatedPrevious =
    previousJson.length > MAX_CORRECTION_JSON_CHARS
      ? `${previousJson.slice(0, MAX_CORRECTION_JSON_CHARS)}\n\n[Truncated.]`
      : previousJson;

  const errorList = errors.map((error) => `- ${error}`).join("\n");

  return `Your previous search plan JSON failed validation. Fix all issues and return a corrected complete JSON object.

Project URL: ${projectUrl}

Confirmed prospecting brief:
${brief.trim()}

Validation errors:
${errorList}

Previous invalid JSON:
${truncatedPrevious}

Return a corrected complete JSON object matching this shape (4–8 opportunityHypotheses, 8–12 queries; not a partial patch, not an explanation):
${SEARCH_PLAN_JSON_EXAMPLE}`;
}
