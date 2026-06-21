import type { KeptDomainCandidate } from "@/lib/candidates/types";
import { getLlmClient } from "@/lib/llm";
import { LlmTimeoutError } from "@/lib/llm/timeout-error";
import { LlmEmptyResponseError } from "@/lib/llm/empty-response-error";
import type { SearchQueryResultGroup } from "@/lib/perplexity/types";
import type { SearchPlan } from "@/lib/search-plan/types";
import { getJudgmentLlmTimeoutMs } from "./config";
import {
  buildDomainInvestigationInput,
  getHomepageUrl,
} from "./build-input";
import {
  DOMAIN_DECISION_SYSTEM_PROMPT,
  READ_PAGES_PLAN_SYSTEM_PROMPT,
  SITE_SEARCH_PLAN_SYSTEM_PROMPT,
  buildDecisionCorrectionUserPrompt,
  buildDecisionUserPrompt,
  buildReadPagesPlanUserPrompt,
  buildSiteSearchPlanUserPrompt,
} from "./prompt";
import { countSuccessfulReadPages, runReadPages } from "./read-pages";
import {
  buildFallbackSiteSearchQuery,
  runSiteSearch,
} from "./site-search";
import type {
  DomainInvestigationResult,
  DomainInvestigationTiming,
  DomainInvestigationTrace,
  InvestigateDomainResult,
  LlmReadPagesPlan,
  LlmSiteSearchPlan,
  SiteSearchToolResult,
} from "./types";
import {
  validateDomainDecision,
  validateReadPagesPlan,
  validateSiteSearchPlan,
} from "./validate";

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

function emptyTiming(): DomainInvestigationTiming {
  return {
    totalMs: 0,
    llmMs: 0,
    siteSearchMs: 0,
    readPagesMs: 0,
  };
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof LlmTimeoutError) {
    return true;
  }

  return error instanceof Error && error.name === "AbortError";
}

function isRetriableLlmError(error: unknown): boolean {
  return isTimeoutError(error) || error instanceof LlmEmptyResponseError;
}

function retriableLlmErrorMessage(error: unknown): string {
  if (error instanceof LlmEmptyResponseError) {
    return error.message;
  }

  return timeoutMessage(error);
}

function timeoutMessage(error: unknown): string {
  if (error instanceof LlmTimeoutError) {
    return error.message;
  }

  return "Request timed out.";
}

async function callInvestigationLlm(
  systemPrompt: string,
  userPrompt: string,
  timing: DomainInvestigationTiming,
): Promise<string> {
  const client = getLlmClient();
  if (!client) {
    throw new Error("config_missing");
  }

  const startedAt = Date.now();

  try {
    const result = await client.completeText(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.4,
        maxTokens: 4096,
        jsonMode: true,
        timeoutMs: getJudgmentLlmTimeoutMs(),
      },
    );

    return result.content.trim();
  } finally {
    timing.llmMs += Date.now() - startedAt;
  }
}

function dedupeUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const url of urls) {
    if (!url) {
      continue;
    }

    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    deduped.push(trimmed);
  }

  return deduped;
}

function buildFallbackReadPagesPlan(
  representativeUrl: string,
  siteSearch: SiteSearchToolResult,
): LlmReadPagesPlan {
  const homepageUrl = getHomepageUrl(representativeUrl);
  const evidenceUrls = siteSearch.evidence.map((item) => item.url);

  const urls = dedupeUrls([homepageUrl, representativeUrl, ...evidenceUrls]).slice(
    0,
    5,
  );

  return {
    urls,
    rationale:
      "Fallback selection: homepage, representative URL, and top site_search evidence URLs.",
  };
}

async function resolveSiteSearchPlan(
  input: ReturnType<typeof buildDomainInvestigationInput>,
  timing: DomainInvestigationTiming,
): Promise<{ plan: LlmSiteSearchPlan; usedFallback: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  try {
    const raw = await callInvestigationLlm(
      SITE_SEARCH_PLAN_SYSTEM_PROMPT,
      buildSiteSearchPlanUserPrompt(input),
      timing,
    );

    if (raw) {
      const parsed = parseJsonResponse(raw);
      const validation = parsed.ok
        ? validateSiteSearchPlan(parsed.value)
        : {
            ok: false as const,
            errors: [`Invalid JSON: ${ parsed.error }`],
          };

      if (validation.ok) {
        return {
          plan: validation.plan,
          usedFallback: false,
          warnings: [...warnings, ...validation.warnings],
        };
      }

      warnings.push(
        `Site search plan invalid (${ validation.errors.join(" ") }). Using fallback query.`,
      );
    } else {
      warnings.push("Empty site search plan response. Using fallback query.");
    }
  } catch (error) {
    if (isTimeoutError(error)) {
      warnings.push(
        `Site search plan LLM call timed out. Using fallback query. (${ timeoutMessage(error) })`,
      );
    } else if (error instanceof LlmEmptyResponseError) {
      warnings.push(
        "Site search plan LLM returned empty content. Using fallback query.",
      );
    } else {
      warnings.push("Site search plan LLM call failed. Using fallback query.");
    }
  }

  return {
    plan: {
      query: buildFallbackSiteSearchQuery(input.candidate.domain),
      rationale: "Deterministic fallback query for external-feature behavior.",
    },
    usedFallback: true,
    warnings,
  };
}

async function resolveReadPagesPlan(
  input: ReturnType<typeof buildDomainInvestigationInput>,
  siteSearch: SiteSearchToolResult,
  timing: DomainInvestigationTiming,
): Promise<{ plan: LlmReadPagesPlan; usedFallback: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  try {
    const raw = await callInvestigationLlm(
      READ_PAGES_PLAN_SYSTEM_PROMPT,
      buildReadPagesPlanUserPrompt(input, siteSearch),
      timing,
    );

    if (raw) {
      const parsed = parseJsonResponse(raw);
      const validation = parsed.ok
        ? validateReadPagesPlan(parsed.value)
        : {
            ok: false as const,
            errors: [`Invalid JSON: ${ parsed.error }`],
          };

      if (validation.ok) {
        return {
          plan: validation.plan,
          usedFallback: false,
          warnings: [...warnings, ...validation.warnings],
        };
      }

      warnings.push(
        `Read pages plan invalid (${ validation.errors.join(" ") }). Using fallback URLs.`,
      );
    } else {
      warnings.push("Empty read pages plan response. Using fallback URLs.");
    }
  } catch (error) {
    if (isTimeoutError(error)) {
      warnings.push(
        `Read pages plan LLM call timed out. Using fallback URLs. (${ timeoutMessage(error) })`,
      );
    } else if (error instanceof LlmEmptyResponseError) {
      warnings.push(
        "Read pages plan LLM returned empty content. Using fallback URLs.",
      );
    } else {
      warnings.push("Read pages plan LLM call failed. Using fallback URLs.");
    }
  }

  return {
    plan: buildFallbackReadPagesPlan(
      input.candidate.representativeUrl,
      siteSearch,
    ),
    usedFallback: true,
    warnings,
  };
}

async function resolveDomainDecision(
  input: ReturnType<typeof buildDomainInvestigationInput>,
  siteSearch: SiteSearchToolResult,
  readPages: Awaited<ReturnType<typeof runReadPages>>,
  timing: DomainInvestigationTiming,
): Promise<
  | {
      ok: true;
      decision: NonNullable<DomainInvestigationResult["decision"]>;
      warnings: string[];
    }
  | { ok: false; message: string; warnings: string[] }
> {
  const warnings: string[] = [];

  try {
    let rawResponse = await callInvestigationLlm(
      DOMAIN_DECISION_SYSTEM_PROMPT,
      buildDecisionUserPrompt(input, siteSearch, readPages),
      timing,
    );

    if (!rawResponse) {
      return {
        ok: false,
        message: "The domain decision could not be generated.",
        warnings,
      };
    }

    let parsed = parseJsonResponse(rawResponse);
    let validation = parsed.ok
      ? validateDomainDecision(
          parsed.value,
          input.candidate.domain,
          siteSearch,
          readPages,
        )
      : {
          ok: false as const,
          errors: [`Invalid JSON: ${ parsed.error }`],
        };

    if (!validation.ok) {
      const correctionResponse = await callInvestigationLlm(
        DOMAIN_DECISION_SYSTEM_PROMPT,
        buildDecisionCorrectionUserPrompt(
          input,
          siteSearch,
          readPages,
          validation.errors,
          rawResponse,
        ),
        timing,
      );

      if (!correctionResponse) {
        return {
          ok: false,
          message: validation.errors.join(" "),
          warnings,
        };
      }

      rawResponse = correctionResponse;
      parsed = parseJsonResponse(rawResponse);
      validation = parsed.ok
        ? validateDomainDecision(
            parsed.value,
            input.candidate.domain,
            siteSearch,
            readPages,
          )
        : {
            ok: false as const,
            errors: [`Invalid JSON: ${ parsed.error }`],
          };

      if (!validation.ok) {
        return {
          ok: false,
          message: validation.errors.join(" "),
          warnings,
        };
      }
    }

    return {
      ok: true,
      decision: validation.decision,
      warnings: [...warnings, ...validation.warnings],
    };
  } catch (error) {
    if (isRetriableLlmError(error)) {
      return {
        ok: false,
        message: `Domain decision LLM call failed. ${ retriableLlmErrorMessage(error) }`,
        warnings,
      };
    }

    throw error;
  }
}

export async function investigateDomain(
  brief: string,
  candidate: KeptDomainCandidate,
  searchPlan: SearchPlan,
  searchResults: SearchQueryResultGroup[],
): Promise<InvestigateDomainResult> {
  const trimmedBrief = brief.trim();

  if (!trimmedBrief) {
    return {
      ok: false,
      reason: "brief_empty",
      message: "Enter a prospecting brief before investigating domains.",
      result: null,
    };
  }

  if (!getLlmClient()) {
    return {
      ok: false,
      reason: "config_missing",
      message: "LLM is not configured. Add JUDGMENT_LLM_API_KEY to .env.local.",
      result: null,
    };
  }

  const totalStartedAt = Date.now();
  const timing = emptyTiming();
  const input = buildDomainInvestigationInput(
    trimmedBrief,
    candidate,
    searchPlan,
    searchResults,
  );
  const warnings: string[] = [];
  const trace: DomainInvestigationTrace = {
    siteSearchQuery: "",
    siteSearchUsedFallback: false,
    readPageUrls: [],
    steps: [],
  };

  try {
    console.log(`[domain-investigation] Starting ${ candidate.domain }`);

    const siteSearchPlan = await resolveSiteSearchPlan(input, timing);
    warnings.push(...siteSearchPlan.warnings);
    trace.siteSearchUsedFallback = siteSearchPlan.usedFallback;

    const siteSearchStartedAt = Date.now();
    const siteSearch = await runSiteSearch(
      candidate.domain,
      siteSearchPlan.plan.query,
    );
    timing.siteSearchMs += Date.now() - siteSearchStartedAt;

    siteSearch.usedFallbackQuery = siteSearchPlan.usedFallback;
    trace.siteSearchQuery = siteSearch.searchQuery;

    trace.steps.push({
      tool: "site_search",
      ok: siteSearch.ok,
      detail: siteSearch.ok
        ? `Found ${ siteSearch.evidence.length } evidence item(s).`
        : siteSearch.error ?? "site_search failed.",
    });

    if (siteSearchPlan.usedFallback) {
      warnings.push("Used fallback site_search query.");
    }

    const readPagesPlan = await resolveReadPagesPlan(input, siteSearch, timing);
    warnings.push(...readPagesPlan.warnings);
    trace.readPageUrls = readPagesPlan.plan.urls;

    const readPagesStartedAt = Date.now();
    const readPages = await runReadPages(readPagesPlan.plan.urls);
    timing.readPagesMs += Date.now() - readPagesStartedAt;

    const successfulReads = countSuccessfulReadPages(readPages);

    trace.steps.push({
      tool: "read_pages",
      ok: successfulReads > 0,
      detail: `${ successfulReads }/${ readPages.pages.length } page read(s) succeeded.`,
    });

    if (readPagesPlan.usedFallback) {
      warnings.push("Used fallback read_pages URL selection.");
    }

    const decisionResult = await resolveDomainDecision(
      input,
      siteSearch,
      readPages,
      timing,
    );
    warnings.push(...decisionResult.warnings);

    timing.totalMs = Date.now() - totalStartedAt;

    if (!decisionResult.ok) {
      console.error(
        `[domain-investigation] ${ candidate.domain } decision failed: ${ decisionResult.message }`,
      );

      const result: DomainInvestigationResult = {
        domain: candidate.domain,
        ok: false,
        input,
        siteSearch,
        readPages,
        decision: null,
        trace,
        timing,
        warnings,
        error: decisionResult.message,
      };

      return { ok: true, result };
    }

    console.log(
      `[domain-investigation] ${ candidate.domain } finished in ${ timing.totalMs }ms (${ decisionResult.decision.decision })`,
    );

    const result: DomainInvestigationResult = {
      domain: candidate.domain,
      ok: true,
      input,
      siteSearch,
      readPages,
      decision: decisionResult.decision,
      trace,
      timing,
      warnings,
      error: null,
    };

    return { ok: true, result };
  } catch (error) {
    timing.totalMs = Date.now() - totalStartedAt;

    const message =
      error instanceof Error
        ? error.message
        : "Domain investigation failed unexpectedly.";

    console.error(
      `[domain-investigation] ${ candidate.domain } failed unexpectedly: ${ message }`,
    );

    const result: DomainInvestigationResult = {
      domain: candidate.domain,
      ok: false,
      input,
      siteSearch: null,
      readPages: null,
      decision: null,
      trace,
      timing,
      warnings,
      error: message,
    };

    return { ok: true, result };
  }
}
