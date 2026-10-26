import { PERPLEXITY_DOMAIN_DENYLIST } from "../discovery/blocked-domains.ts";
import type { PerplexityConfig } from "./config.ts";
import type { PerplexitySearchPage, PerplexitySearchResponse } from "./types.ts";

const DEFAULT_SEARCH_TIMEOUT_MS = 30_000;

type SearchWebOptions = {
  query: string;
  maxResults: number;
  timeoutMs?: number;
};

type ApiSearchPage = {
  title?: string;
  url?: string;
  snippet?: string;
  date?: string | null;
  last_updated?: string | null;
};

type ApiSearchResponse = {
  id?: string;
  results?: ApiSearchPage[];
  server_time?: string | null;
};

export class PerplexityInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerplexityInvalidResponseError";
  }
}

export class PerplexityApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PerplexityApiError";
    this.status = status;
  }
}

function parseSearchPage(page: ApiSearchPage): PerplexitySearchPage {
  return {
    title: typeof page.title === "string" ? page.title : "",
    url: typeof page.url === "string" ? page.url : "",
    snippet: typeof page.snippet === "string" ? page.snippet : "",
    date: typeof page.date === "string" ? page.date : null,
    lastUpdated:
      typeof page.last_updated === "string" ? page.last_updated : null,
  };
}

export async function searchWeb(
  config: PerplexityConfig,
  options: SearchWebOptions,
): Promise<PerplexitySearchResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/search`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        query: options.query,
        max_results: options.maxResults,
        search_domain_filter: [...PERPLEXITY_DOMAIN_DENYLIST],
      }),
    });

    const payload = (await response.json()) as ApiSearchResponse;

    if (!response.ok) {
      const detail =
        typeof payload === "object" &&
        payload !== null &&
        "detail" in payload &&
        Array.isArray((payload as { detail?: unknown }).detail)
          ? JSON.stringify((payload as { detail: unknown }).detail)
          : response.statusText;

      throw new PerplexityApiError(
        response.status,
        `Perplexity search failed (${response.status}): ${detail}`,
      );
    }

    if (!Array.isArray(payload.results)) {
      throw new PerplexityInvalidResponseError(
        "Perplexity search returned an invalid response.",
      );
    }

    return {
      id: typeof payload.id === "string" ? payload.id : "",
      results: payload.results.map(parseSearchPage),
      serverTime:
        typeof payload.server_time === "string" ? payload.server_time : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
