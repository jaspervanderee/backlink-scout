export const DEFAULT_JUDGMENT_LLM_TIMEOUT_MS = 60_000;

/** Search plans are large JSON payloads and can run longer than per-domain investigation. */
export const SEARCH_PLAN_LLM_TIMEOUT_MS = 120_000;

export const INVESTIGATION_PAGE_FETCH_TIMEOUT_MS = 10_000;

export const INVESTIGATION_READ_PAGES_CONCURRENCY = 3;

export const INVESTIGATION_DOMAIN_CONCURRENCY = 3;

export function getJudgmentLlmTimeoutMs(): number {
  const raw = process.env.JUDGMENT_LLM_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_JUDGMENT_LLM_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 5_000) {
    return DEFAULT_JUDGMENT_LLM_TIMEOUT_MS;
  }

  return parsed;
}
