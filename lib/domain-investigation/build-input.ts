import type { KeptDomainCandidate } from "@/lib/candidates/types";
import type { SearchQueryResultGroup } from "@/lib/perplexity/types";
import type { SearchPlan } from "@/lib/search-plan/types";
import type {
  DomainInvestigationInput,
  SearchQueryContext,
  SearchQueryContextHit,
} from "./types";

function buildHitsForQuery(
  candidate: KeptDomainCandidate,
  queryId: string,
): SearchQueryContextHit[] {
  return candidate.sourceHits
    .filter((hit) => hit.queryId === queryId)
    .map((hit) => ({
      queryId: hit.queryId,
      resultRank: hit.resultRank,
      url: hit.url,
      normalizedUrl: hit.normalizedUrl,
      title: hit.title,
      snippet: hit.snippet,
      date: hit.date,
      lastUpdated: hit.lastUpdated,
    }));
}

export function buildDomainInvestigationInput(
  brief: string,
  candidate: KeptDomainCandidate,
  searchPlan: SearchPlan,
  searchResults: SearchQueryResultGroup[],
): DomainInvestigationInput {
  const queryById = new Map(
    searchPlan.queries.map((query) => [query.id, query]),
  );

  const searchQueryContext: SearchQueryContext[] = [];

  for (const queryId of candidate.sourceQueryIds) {
    const query = queryById.get(queryId);
    if (!query) {
      continue;
    }

    searchQueryContext.push({
      queryId: query.id,
      queryText: query.queryText,
      hypothesisUsed: query.hypothesisUsed,
      priority: query.priority,
      rationale: query.rationale,
      expectedPageType: query.expectedPageType,
      riskNote: query.riskNote,
      hits: buildHitsForQuery(candidate, queryId),
    });
  }

  for (const group of searchResults) {
    if (!group.ok) {
      continue;
    }

    if (!candidate.sourceQueryIds.includes(group.query.id)) {
      continue;
    }

    const existing = searchQueryContext.find(
      (context) => context.queryId === group.query.id,
    );
    if (existing) {
      continue;
    }

    searchQueryContext.push({
      queryId: group.query.id,
      queryText: group.query.queryText,
      hypothesisUsed: group.query.hypothesisUsed,
      priority: group.query.priority,
      rationale: group.query.rationale,
      expectedPageType: group.query.expectedPageType,
      riskNote: group.query.riskNote,
      hits: buildHitsForQuery(candidate, group.query.id),
    });
  }

  return {
    brief: brief.trim(),
    candidate,
    searchQueryContext,
  };
}

export function getHomepageUrl(representativeUrl: string): string | null {
  try {
    const parsed = new URL(representativeUrl);
    return `${ parsed.protocol }//${ parsed.host }/`;
  } catch {
    return null;
  }
}
