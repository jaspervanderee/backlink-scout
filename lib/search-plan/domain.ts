import type { LlmSearchPlan, SearchPlan } from "./types";

export function extractHostname(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeSearchResultUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    parsed.hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    parsed.hash = "";

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.href;
  } catch {
    return null;
  }
}

export function queryContainsDomain(query: string, domain: string): boolean {
  const normalizedQuery = query.toLowerCase();
  const normalizedDomain = domain.replace(/^www\./i, "").toLowerCase();

  if (!normalizedDomain) {
    return false;
  }

  return normalizedQuery.includes(normalizedDomain);
}

export function assignQueryIds(plan: LlmSearchPlan): SearchPlan {
  return {
    ...plan,
    queries: plan.queries.map((query, index) => ({
      ...query,
      id: `query-${String(index + 1).padStart(2, "0")}`,
    })),
  };
}
