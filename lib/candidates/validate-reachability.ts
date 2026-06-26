import { probeUrlReachability } from "./probe-url";
import type {
  CandidateRemovalReason,
  KeptDomainCandidate,
  PrepareCandidatesResult,
  RemovedDomainCandidate,
  SourceHit,
  ValidateReachabilityResult,
} from "./types";

const REACHABILITY_PROBE_CONCURRENCY = 6;

function compareSourceHits(first: SourceHit, second: SourceHit): number {
  if (first.queryOrder !== second.queryOrder) {
    return first.queryOrder - second.queryOrder;
  }

  return first.resultRank - second.resultRank;
}

function hitUrl(hit: SourceHit): string {
  return hit.normalizedUrl ?? hit.url;
}

function uniqueHitUrls(sourceHits: SourceHit[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const sortedHits = [...sourceHits].sort(compareSourceHits);

  for (const hit of sortedHits) {
    const url = hitUrl(hit).trim();
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);
  }

  return urls;
}

function removalReasonForProbe(
  statusCode: number | null,
): CandidateRemovalReason {
  if (statusCode !== null && isBlockedStatusCode(statusCode)) {
    return "access_blocked";
  }

  return "unreachable_url";
}

function isBlockedStatusCode(statusCode: number): boolean {
  return (
    statusCode === 401 ||
    statusCode === 402 ||
    statusCode === 403 ||
    statusCode === 429
  );
}

function findRepresentativeHit(
  sourceHits: SourceHit[],
  verifiedUrl: string,
): SourceHit {
  const sortedHits = [...sourceHits].sort(compareSourceHits);
  const match = sortedHits.find((hit) => hitUrl(hit) === verifiedUrl);
  return match ?? sortedHits[0];
}

async function validateCandidate(
  candidate: KeptDomainCandidate,
): Promise<
  | { kind: "kept"; candidate: KeptDomainCandidate }
  | { kind: "removed"; candidate: RemovedDomainCandidate }
> {
  const urls = uniqueHitUrls(candidate.sourceHits);

  if (urls.length === 0) {
    return {
      kind: "removed",
      candidate: {
        ...candidate,
        removalReason: "unreachable_url",
      },
    };
  }

  let lastStatusCode: number | null = null;

  for (const url of urls) {
    const probe = await probeUrlReachability(url);
    lastStatusCode = probe.statusCode;

    if (probe.ok) {
      const hit = findRepresentativeHit(candidate.sourceHits, url);
      const representativeUrl = probe.finalUrl || hitUrl(hit);

      return {
        kind: "kept",
        candidate: {
          ...candidate,
          representativeUrl,
          representativeTitle: hit.title,
        },
      };
    }
  }

  return {
    kind: "removed",
    candidate: {
      ...candidate,
      removalReason: removalReasonForProbe(lastStatusCode),
    },
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        break;
      }

      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

export async function validateCandidateReachability(
  candidates: KeptDomainCandidate[],
): Promise<ValidateReachabilityResult> {
  const outcomes = await mapWithConcurrency(
    candidates,
    REACHABILITY_PROBE_CONCURRENCY,
    (candidate) => validateCandidate(candidate),
  );

  const kept: KeptDomainCandidate[] = [];
  const removed: RemovedDomainCandidate[] = [];

  for (const outcome of outcomes) {
    if (outcome.kind === "kept") {
      kept.push(outcome.candidate);
      continue;
    }

    removed.push(outcome.candidate);
  }

  kept.sort((first, second) => first.domain.localeCompare(second.domain));
  removed.sort((first, second) => first.domain.localeCompare(second.domain));

  return { ok: true, kept, removed };
}

export function mergeCandidatePreparation(
  preparation: PrepareCandidatesResult,
  reachability: ValidateReachabilityResult,
): PrepareCandidatesResult {
  const removed = [...preparation.removed, ...reachability.removed];

  return {
    ok: true,
    stats: {
      ...preparation.stats,
      keptDomainsCount: reachability.kept.length,
      removedDomainsCount: removed.length,
    },
    kept: reachability.kept,
    removed,
  };
}
