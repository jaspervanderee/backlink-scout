export type SearchPlanPriority = "high" | "medium" | "low";

export type SearchPlanMetadata = {
  projectCategory: string;
  targetAudiences: string[];
  searchLanguage: string;
  searchCountryRegion: string | null;
  excludedDomains: string[];
  assumptions: string[];
};

export type LlmSearchQuery = {
  queryText: string;
  hypothesisUsed: string;
  priority: SearchPlanPriority;
  rationale: string;
  expectedPageType: string;
  riskNote: string;
  recommendedResultCount: number;
};

export type LlmSearchPlan = {
  metadata: SearchPlanMetadata;
  opportunityHypotheses: string[];
  queries: LlmSearchQuery[];
};

export type SearchQuery = LlmSearchQuery & {
  id: string;
};

export type SearchPlan = {
  metadata: SearchPlanMetadata;
  opportunityHypotheses: string[];
  queries: SearchQuery[];
};

export type GenerateSearchPlanResult =
  | { ok: true; plan: SearchPlan; warnings: string[] }
  | {
      ok: false;
      reason:
        | "brief_empty"
        | "llm_failed"
        | "validation_failed"
        | "config_missing";
      message: string;
    };
