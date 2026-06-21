import { extractHostname } from "@/lib/search-plan/domain";
import { getPerplexityConfig } from "@/lib/perplexity/config";
import { searchWeb } from "@/lib/perplexity/client";
import type { SiteSearchEvidence, SiteSearchToolResult } from "./types";

const MAX_SITE_SEARCH_RESULTS = 8;

export function buildFallbackSiteSearchQuery(domain: string): string {
  const featureTokens =
    "featured OR roundup OR resources OR tools OR interview OR showcase OR directory OR submit OR curated OR recommended";
  return `site:${ domain } (${ featureTokens })`;
}

export function ensureSiteScopedQuery(domain: string, query: string): string {
  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();
  const siteToken = `site:${ domain.toLowerCase() }`;

  if (lowerQuery.includes("site:")) {
    return trimmed;
  }

  return `${ siteToken } ${ trimmed }`;
}

function hostMatchesDomain(url: string, domain: string): boolean {
  const hostname = extractHostname(url);
  if (!hostname) {
    return false;
  }

  return hostname === domain.replace(/^www\./i, "").toLowerCase();
}

export async function runSiteSearch(
  domain: string,
  query: string,
): Promise<SiteSearchToolResult> {
  const config = getPerplexityConfig();
  const scopedQuery = ensureSiteScopedQuery(domain, query);

  if (!config) {
    return {
      ok: false,
      searchQuery: scopedQuery,
      evidence: [],
      usedFallbackQuery: false,
      error: "Perplexity is not configured.",
    };
  }

  try {
    const response = await searchWeb(config, {
      query: scopedQuery,
      maxResults: MAX_SITE_SEARCH_RESULTS,
    });

    const evidence: SiteSearchEvidence[] = response.results
      .filter((page) => hostMatchesDomain(page.url, domain))
      .map((page) => ({
        url: page.url,
        title: page.title,
        snippet: page.snippet,
        date: page.date,
        lastUpdated: page.lastUpdated,
        searchQuery: scopedQuery,
      }));

    return {
      ok: true,
      searchQuery: scopedQuery,
      evidence,
      usedFallbackQuery: false,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Perplexity site search failed.";

    return {
      ok: false,
      searchQuery: scopedQuery,
      evidence: [],
      usedFallbackQuery: false,
      error: message,
    };
  }
}
