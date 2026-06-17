const MAX_CORRECTION_JSON_CHARS = 12_000;

const EXAMPLE_HYPOTHESES = [
  "Direct topical opportunity: why sites in the project's core subject area might feature or link to it.",
  "Broader editorial-fit opportunity: design or culture sites might feature this for visual, aesthetic, or cultural relevance.",
  "Broader editorial-fit opportunity: maker, creator, or product-discovery sites might feature this for usefulness or novelty.",
  "Broader editorial-fit opportunity: gift guides, newsletters, or curator roundups might include this as a distinctive find.",
] as const;

function buildExampleQuery(
  hypothesisUsed: string,
  index: number,
): {
  queryText: string;
  hypothesisUsed: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  expectedPageType: string;
  riskNote: string;
  recommendedResultCount: number;
} {
  const priority: "high" | "medium" | "low" =
    index <= 2 ? "high" : index <= 5 ? "medium" : "low";

  return {
    queryText: `example editorial search query ${index}`,
    hypothesisUsed,
    priority,
    rationale: "why this query could surface linkable editorial pages",
    expectedPageType: "roundup, directory, newsletter feature, or curated list",
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

export const SEARCH_PLAN_SYSTEM_PROMPT = `You are a backlink prospecting strategist. Your job is to read a confirmed prospecting brief and produce a search query plan for finding legitimate editorial outreach opportunities.

Ask yourself: who might care enough to feature, list, recommend, write about, curate, or link to this project, even if their site is not literally about the exact topic?

Opportunity hypotheses (critical):
- Infer 4–8 opportunityHypotheses. When the brief supports it, include BOTH direct topical opportunities AND broader editorial-fit opportunities — not mostly variations of the same topic.
- Do not cluster hypotheses around the same narrow keyword theme. Each hypothesis should represent a meaningfully different reason a site might link.
- Before writing hypotheses, ask:
  - What broader editorial worlds might care about this?
  - Would design, culture, product, maker, creator, gift, newsletter, or curator sites care?
  - What makes this feature-worthy beyond the literal subject?
- Some hypotheses may be literal/topic-based. Others should be broader editorial opportunities based on usefulness, novelty, design quality, cultural relevance, timing, community relevance, or curatorial fit — but only when the brief supports that angle.

Queries:
- Generate 8–12 queries. Each query must reference exactly one hypothesis via hypothesisUsed (exact string match to one opportunityHypotheses entry).
- Spread queries across different hypotheses — do not write most queries as slight rephrasings of the same topic.
- Every query needs a realistic editorial backlink path — broad does not mean random.
- Avoid queries that primarily look like buyer or ecommerce searches (e.g. buy, shop, price, cheap, for sale, order, discount) unless expectedPageType is clearly an editorial guide, roundup, feature, showcase, or curated list — and the rationale explains that editorial intent.

General rules:
- Use the confirmed brief as your only source of truth.
- Do not include query id fields — IDs are assigned server-side after generation.
- Derive metadata from the brief: projectCategory, targetAudiences, searchLanguage, excludedDomains, assumptions. Set searchCountryRegion to a string when the brief implies a geo focus; otherwise null.
- Set excludedDomains to include the project domain.
- Avoid generic keyword stuffing and paid-link tactics.
- Do not invent specific publication or brand names unless grounded in the brief.
- priority must be high, medium, or low.
- recommendedResultCount must be an integer between 5 and 10.
- Return only valid JSON matching the example shape (4–8 opportunityHypotheses, 8–12 queries). No preamble, no markdown fences.`;

export function buildSearchPlanUserPrompt(
  brief: string,
  projectUrl: string,
): string {
  return `Create a search query plan for this project.

Project URL: ${projectUrl}

Confirmed prospecting brief:
${brief.trim()}

Include a mix of direct topical hypotheses and broader editorial-fit hypotheses when the brief supports them. Avoid making most hypotheses or queries narrow rephrasings of the same topic.

Return JSON with this shape (example shows the minimum valid counts: 4 hypotheses, 8 queries; you may use up to 8 hypotheses and 12 queries):
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
