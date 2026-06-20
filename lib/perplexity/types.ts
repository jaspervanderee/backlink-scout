import type { SearchQuery } from "@/lib/search-plan/types";

export type PerplexitySearchPage = {
  title: string;
  url: string;
  snippet: string;
  date: string | null;
  lastUpdated: string | null;
};

export type PerplexitySearchResponse = {
  id: string;
  results: PerplexitySearchPage[];
  serverTime: string | null;
};

export type SearchQueryFailureReason =
  | "api_error"
  | "invalid_response"
  | "timeout";

export type SearchQueryResultGroup =
  | {
      ok: true;
      query: SearchQuery;
      requestedMaxResults: number;
      response: PerplexitySearchResponse;
    }
  | {
      ok: false;
      query: SearchQuery;
      requestedMaxResults: number;
      reason: SearchQueryFailureReason;
      message: string;
    };

export type ExecuteSearchPlanResult =
  | { ok: true; groups: SearchQueryResultGroup[]; warnings: string[] }
  | {
      ok: false;
      reason: "plan_empty" | "config_missing" | "all_queries_failed";
      message: string;
      groups: SearchQueryResultGroup[];
    };
