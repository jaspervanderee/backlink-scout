export type SourceHit = {
  queryId: string;
  queryOrder: number;
  resultRank: number;
  url: string;
  normalizedUrl: string | null;
  title: string;
};

export type DomainCandidateBase = {
  domain: string;
  representativeUrl: string;
  representativeTitle: string;
  sourceHits: SourceHit[];
  sourceQueryIds: string[];
};

export type KeptDomainCandidate = DomainCandidateBase;

export type CandidateRemovalReason =
  | "invalid_domain"
  | "blocked_platform"
  | "blocked_marketplace"
  | "blocked_stock_asset"
  | "blocked_template"
  | "blocked_large_retail";

export type RemovedDomainCandidate = DomainCandidateBase & {
  removalReason: CandidateRemovalReason;
};

export type PrepareCandidatesStats = {
  totalRawHits: number;
  uniqueDomainsBeforeFiltering: number;
  keptDomainsCount: number;
  removedDomainsCount: number;
};

export type PrepareCandidatesResult = {
  ok: true;
  stats: PrepareCandidatesStats;
  kept: KeptDomainCandidate[];
  removed: RemovedDomainCandidate[];
};
