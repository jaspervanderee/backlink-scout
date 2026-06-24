import type { KeptDomainCandidate } from "@/lib/candidates/types";
import type { PageLink, PageMetadata } from "@/lib/fetch-and-extract/types";
import type { SearchPlanPriority } from "@/lib/search-plan/types";

export type DomainDecisionValue = "promising" | "maybe" | "skip";

export type DomainConfidence = "high" | "medium" | "low";

export type OpportunityType =
  | "existing_inclusion"
  | "resource_listing"
  | "roundup_guide"
  | "editorial_feature"
  | "newsletter_blog_pitch"
  | "not_a_fit";

export type SearchQueryContextHit = {
  queryId: string;
  resultRank: number;
  url: string;
  normalizedUrl: string | null;
  title: string;
  snippet: string;
  date: string | null;
  lastUpdated: string | null;
};

export type SearchQueryContext = {
  queryId: string;
  queryText: string;
  hypothesisUsed: string;
  priority: SearchPlanPriority;
  rationale: string;
  expectedPageType: string;
  riskNote: string;
  hits: SearchQueryContextHit[];
};

export type DomainInvestigationInput = {
  brief: string;
  candidate: KeptDomainCandidate;
  searchQueryContext: SearchQueryContext[];
};

export type LlmSiteSearchPlan = {
  query: string;
  rationale: string;
};

export type LlmReadPagesPlan = {
  urls: string[];
  rationale: string;
};

export type SiteSearchEvidence = {
  url: string;
  title: string;
  snippet: string;
  date: string | null;
  lastUpdated: string | null;
  searchQuery: string;
};

export type SiteSearchToolResult = {
  ok: boolean;
  searchQuery: string;
  evidence: SiteSearchEvidence[];
  usedFallbackQuery: boolean;
  error: string | null;
};

export type ReadPageResult = {
  requestedUrl: string;
  ok: boolean;
  finalUrl: string | null;
  statusCode: number | null;
  reason: string | null;
  message: string | null;
  metadata: PageMetadata | null;
  contentMarkdown: string;
  contentText: string;
  links: PageLink[];
};

export type ReadPagesToolResult = {
  pages: ReadPageResult[];
};

export type DomainDecision = {
  domain: string;
  decision: DomainDecisionValue;
  opportunityType: OpportunityType;
  externalFeatureEvidence: string;
  evidencePagesInspected: string[];
  fitRationale: string;
  incentivesOrConflicts: string;
  riskNotes: string;
  confidence: DomainConfidence;
  evidenceGaps: string;
  toolTraceSummary: string;
};

export type DomainInvestigationTraceStep = {
  tool: "site_search" | "read_pages";
  ok: boolean;
  detail: string;
};

export type DomainInvestigationTrace = {
  siteSearchQuery: string;
  siteSearchUsedFallback: boolean;
  readPageUrls: string[];
  steps: DomainInvestigationTraceStep[];
};

export type DomainInvestigationTiming = {
  totalMs: number;
  llmMs: number;
  siteSearchMs: number;
  readPagesMs: number;
};

export type DomainInvestigationResult = {
  domain: string;
  ok: boolean;
  input: DomainInvestigationInput;
  siteSearch: SiteSearchToolResult | null;
  readPages: ReadPagesToolResult | null;
  decision: DomainDecision | null;
  trace: DomainInvestigationTrace;
  timing: DomainInvestigationTiming;
  warnings: string[];
  error: string | null;
};

export type InvestigateDomainResult =
  | { ok: true; result: DomainInvestigationResult }
  | {
      ok: false;
      reason: "brief_empty" | "config_missing";
      message: string;
      result: DomainInvestigationResult | null;
    };

export type DomainInvestigationProgress = {
  total: number;
  completed: number;
  inProgress: string[];
  results: DomainInvestigationResult[];
  warnings: string[];
  isRunning: boolean;
  error: string | null;
};

export type InvestigateDomainsStats = {
  totalDomains: number;
  succeededCount: number;
  failedCount: number;
  promisingCount: number;
  maybeCount: number;
  skipCount: number;
};
