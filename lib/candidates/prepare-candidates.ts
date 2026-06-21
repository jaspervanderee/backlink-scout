import type { SearchQueryResultGroup } from "@/lib/perplexity/types";
import { extractHostname, normalizeSearchResultUrl } from "@/lib/search-plan/domain";
import { getBlockedDomainReason } from "./blocked-domains";
import type {
  DomainCandidateBase,
  KeptDomainCandidate,
  PrepareCandidatesResult,
  RemovedDomainCandidate,
  SourceHit,
} from "./types";

function compareSourceHits(first: SourceHit, second: SourceHit): number {
  if (first.queryOrder !== second.queryOrder) {
    return first.queryOrder - second.queryOrder;
  }

  return first.resultRank - second.resultRank;
}

function buildSourceQueryIds(sourceHits: SourceHit[]): string[] {
  const seen = new Set<string>();
  const queryIds: string[] = [];

  const sortedHits = [...sourceHits].sort(compareSourceHits);

  for (const hit of sortedHits) {
    if (seen.has(hit.queryId)) {
      continue;
    }

    seen.add(hit.queryId);
    queryIds.push(hit.queryId);
  }

  return queryIds;
}

function buildDomainCandidate(
  domain: string,
  sourceHits: SourceHit[],
): DomainCandidateBase {
  const sortedHits = [...sourceHits].sort(compareSourceHits);
  const representative = sortedHits[0];
  const representativeUrl =
    representative.normalizedUrl ?? representative.url;

  return {
    domain,
    representativeUrl,
    representativeTitle: representative.title,
    sourceHits: sortedHits,
    sourceQueryIds: buildSourceQueryIds(sortedHits),
  };
}

function compareDomainsByName(
  first: DomainCandidateBase,
  second: DomainCandidateBase,
): number {
  return first.domain.localeCompare(second.domain);
}

export function prepareCandidates(
  groups: SearchQueryResultGroup[],
): PrepareCandidatesResult {
  const domainBuckets = new Map<string, SourceHit[]>();
  let totalRawHits = 0;

  for (let queryOrder = 0; queryOrder < groups.length; queryOrder += 1) {
    const group = groups[queryOrder];

    if (!group.ok) {
      continue;
    }

    for (
      let resultRank = 0;
      resultRank < group.response.results.length;
      resultRank += 1
    ) {
      const page = group.response.results[resultRank];
      totalRawHits += 1;

      const sourceHit: SourceHit = {
        queryId: group.query.id,
        queryOrder,
        resultRank,
        url: page.url,
        normalizedUrl: normalizeSearchResultUrl(page.url),
        title: page.title,
        snippet: page.snippet,
        date: page.date,
        lastUpdated: page.lastUpdated,
      };

      const domain =
        extractHostname(page.url) ??
        sourceHit.normalizedUrl ??
        page.url.trim();

      const existingHits = domainBuckets.get(domain) ?? [];
      existingHits.push(sourceHit);
      domainBuckets.set(domain, existingHits);
    }
  }

  const uniqueDomainsBeforeFiltering = domainBuckets.size;
  const kept: KeptDomainCandidate[] = [];
  const removed: RemovedDomainCandidate[] = [];

  for (const [domainKey, sourceHits] of domainBuckets) {
    const candidate = buildDomainCandidate(domainKey, sourceHits);
    const hostname = extractHostname(candidate.representativeUrl);

    if (!hostname) {
      removed.push({
        ...candidate,
        removalReason: "invalid_domain",
      });
      continue;
    }

    const blockedReason = getBlockedDomainReason(hostname);

    if (blockedReason) {
      removed.push({
        ...candidate,
        domain: hostname,
        removalReason: blockedReason,
      });
      continue;
    }

    kept.push({
      ...candidate,
      domain: hostname,
    });
  }

  kept.sort(compareDomainsByName);
  removed.sort(compareDomainsByName);

  return {
    ok: true,
    stats: {
      totalRawHits,
      uniqueDomainsBeforeFiltering,
      keptDomainsCount: kept.length,
      removedDomainsCount: removed.length,
    },
    kept,
    removed,
  };
}
