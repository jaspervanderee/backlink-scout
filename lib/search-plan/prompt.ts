const MAX_CORRECTION_JSON_CHARS = 12_000;

const EXAMPLE_QUERY_TEXT =
  "[editorial publisher type] [brief-specific topic angle] [feature|roundup|case study|review|showcase]";

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

export const SEARCH_PLAN_SYSTEM_PROMPT = `You are a backlink prospecting strategist. Your job is to read a confirmed prospecting brief and produce a search query plan for finding legitimate editorial outreach opportunities.

Ask yourself: who might care enough to feature, list, recommend, write about, curate, or link to this project, even if their site is not literally about the exact topic?

Editorial-world abstraction:
- From the brief, infer which editorial worlds might care one level above the literal subject. Use Product context (main and adjacent categories), Link strategy, and Discovery signals (outsider terms, target page categories). Think graphic design, branding, visual culture, indie products, maker/creator media, gift/curator discovery — whatever the brief supports. Do not name specific publications.
- At least half of opportunityHypotheses should describe why an editorial world cares (design, culture, curators, etc.). Only some should be literal subject or fan-community hypotheses.
- queryText should usually lead with publisher/editorial world or angle, not the project's primary keyword. Pattern: [editorial world or angle] [optional subject hint] [editorial format].
- Use the project's primary subject term (franchise name, product name, or main niche keyword from the brief) in at most 4 of 8–12 queries. Other queries stay grounded via adjacent categories, craft, novelty, visual quality, or use case — without repeating the main keyword.

Publisher-discovery language (critical):
- Convert the brief and its adjacent categories into publisher-discovery queries that find pages which publish, curate, feature, analyze, review, showcase, or recommend external work — not pages where a buyer would search for the product.
- Do not copy brief product terms into queryText as if a customer were shopping. Search for the publisher surface, not the asset.
- A query is weak if it mostly sounds like a customer looking for the thing.
- Product nouns (poster, print, wall art, decor, gift, merch, template, app, tool, course) are allowed only when queryText itself includes an editorial page format: feature, showcase, roundup, guide, case study, review, directory, examples, inspiration, interview, or curated list.
- Shopping language (buy, shop, price, cheap, for sale, order, discount) needs the same editorial signal in queryText.
- Do not reuse the JSON example queryText verbatim or with only one or two words changed. Each queryText must be derived from this brief's hypotheses and discovery signals.

Opportunity hypotheses:
- Infer 4–8 opportunityHypotheses. When the brief supports it, include BOTH direct topical opportunities AND broader editorial-fit opportunities — not mostly variations of the same topic.
- Each hypothesis should represent a meaningfully different reason a site might link. Before writing, ask: what broader editorial worlds might care; would design, culture, product, maker, creator, gift, newsletter, or curator sites care; what makes this feature-worthy beyond the literal subject?
- When the brief supports it, prefer feature-oriented opportunities (full editorial features, design/culture writeups, case studies, creator stories, reviews, critiques, showcases) over embed/resource/wiki paths. Do not default every hypothesis to an embeddable asset unless the brief clearly centers one.

Queries:
- Generate 8–12 queries. Each must reference exactly one hypothesis via hypothesisUsed (exact string match).
- Spread queries across different hypotheses and expected page types — not slight rephrasings that would return the same search results.
- Every query needs a realistic editorial backlink path — broad does not mean random.

General rules:
- Use the confirmed brief as your only source of truth.
- Do not include query id fields — IDs are assigned server-side after generation.
- Derive metadata from the brief. Set searchCountryRegion to a string when the brief implies geo focus; otherwise null. Set excludedDomains to include the project domain.
- Avoid generic keyword stuffing and paid-link tactics. Do not invent publication or brand names unless grounded in the brief.
- priority must be high, medium, or low. recommendedResultCount must be an integer between 5 and 10.
- Return only valid JSON matching the example shape (4–8 opportunityHypotheses, 8–12 queries). No preamble, no markdown fences.`;

export function buildSearchPlanUserPrompt(
  brief: string,
  projectUrl: string,
): string {
  return `Create a search query plan for this project.

Project URL: ${projectUrl}

Confirmed prospecting brief:
${brief.trim()}

Infer editorial worlds from adjacent categories and outsider terms in the brief; most queryText should not start with the project's main subject keyword. Do not copy the example queryText pattern verbatim.

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
