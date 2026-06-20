import {
  PerplexityApiError,
  PerplexityInvalidResponseError,
  searchWeb,
} from "./client";
import { getPerplexityConfig } from "./config";
import type {
  ExecuteSearchPlanResult,
  SearchQueryFailureReason,
  SearchQueryResultGroup,
} from "./types";
import type { SearchPlan } from "@/lib/search-plan/types";

function clampMaxResults(count: number): number {
  return Math.min(20, Math.max(1, count));
}

function mapSearchError(error: unknown): {
  reason: SearchQueryFailureReason;
  message: string;
} {
  if (error instanceof PerplexityInvalidResponseError) {
    return {
      reason: "invalid_response",
      message: error.message,
    };
  }

  if (error instanceof PerplexityApiError) {
    return {
      reason: "api_error",
      message: error.message,
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      reason: "timeout",
      message: "The Perplexity search request timed out.",
    };
  }

  if (error instanceof Error) {
    return {
      reason: "api_error",
      message: error.message,
    };
  }

  return {
    reason: "api_error",
    message: "The Perplexity search request failed.",
  };
}

function buildFailureWarning(group: Extract<SearchQueryResultGroup, { ok: false }>): string {
  return `${group.query.id}: ${group.message}`;
}

export async function executeSearchPlan(
  plan: SearchPlan,
): Promise<ExecuteSearchPlanResult> {
  if (plan.queries.length === 0) {
    return {
      ok: false,
      reason: "plan_empty",
      message: "The search plan has no queries to execute.",
      groups: [],
    };
  }

  const config = getPerplexityConfig();
  if (!config) {
    return {
      ok: false,
      reason: "config_missing",
      message:
        "Perplexity is not configured. Add PERPLEXITY_API_KEY to .env.local.",
      groups: [],
    };
  }

  const groups: SearchQueryResultGroup[] = [];

  for (const query of plan.queries) {
    const requestedMaxResults = clampMaxResults(query.recommendedResultCount);

    try {
      const response = await searchWeb(config, {
        query: query.queryText,
        maxResults: requestedMaxResults,
      });

      groups.push({
        ok: true,
        query,
        requestedMaxResults,
        response,
      });
    } catch (caught) {
      const { reason, message } = mapSearchError(caught);

      groups.push({
        ok: false,
        query,
        requestedMaxResults,
        reason,
        message,
      });
    }
  }

  const warnings = groups
    .filter((group): group is Extract<SearchQueryResultGroup, { ok: false }> => !group.ok)
    .map(buildFailureWarning);

  const successCount = groups.filter((group) => group.ok).length;

  if (successCount === 0) {
    return {
      ok: false,
      reason: "all_queries_failed",
      message: "Every Perplexity search query failed.",
      groups,
    };
  }

  return {
    ok: true,
    groups,
    warnings,
  };
}
