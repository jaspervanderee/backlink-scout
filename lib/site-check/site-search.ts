import { extractHostname } from "@/lib/web/hostname";
import { getPerplexityConfig } from "@/lib/perplexity/config";
import { searchWeb } from "@/lib/perplexity/client";
import type { SiteSearchResult } from "./types";

const MAX_SITE_SEARCH_RESULTS = 8;

export function buildFeatureSearchQuery(domain: string): string {
  const featureTokens =
    "featured OR roundup OR resources OR tools OR interview OR showcase OR directory OR submit OR curated OR recommended";
  return `site:${ domain } (${ featureTokens })`;
}

function ensureSiteScopedQuery(domain: string, query: string): string {
  const trimmed = query.trim();
  if (trimmed.toLowerCase().includes("site:")) {
    return trimmed;
  }

  const siteToken = `site:${ domain.toLowerCase() }`;
  return `${ siteToken } ${ trimmed }`;
}

function hostMatchesDomain(url: string, domain: string): boolean {
  const hostname = extractHostname(url);
  return hostname !== null && hostname === domain.replace(/^www\./i, "").toLowerCase();
}

export async function runSiteSearch(domain: string, query: string): Promise<SiteSearchResult> {
  const config = getPerplexityConfig();
  const scopedQuery = ensureSiteScopedQuery(domain, query);

  if (!config) {
    return { ok: false, searchQuery: scopedQuery, evidence: [], error: "Perplexity is not configured." };
  }

  try {
    const response = await searchWeb(config, { query: scopedQuery, maxResults: MAX_SITE_SEARCH_RESULTS });
    const evidence = response.results
      .filter((page) => hostMatchesDomain(page.url, domain))
      .map((page) => ({
        url: page.url,
        title: page.title,
        snippet: page.snippet,
        date: page.date,
        lastUpdated: page.lastUpdated,
      }));

    return { ok: true, searchQuery: scopedQuery, evidence, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Perplexity site search failed.";
    return { ok: false, searchQuery: scopedQuery, evidence: [], error: message };
  }
}
