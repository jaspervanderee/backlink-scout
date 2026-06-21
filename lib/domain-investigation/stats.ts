import type { DomainInvestigationResult, InvestigateDomainsStats } from "./types";

export function buildInvestigationStats(
  results: DomainInvestigationResult[],
): InvestigateDomainsStats {
  let succeededCount = 0;
  let failedCount = 0;
  let promisingCount = 0;
  let maybeCount = 0;
  let skipCount = 0;

  for (const result of results) {
    if (result.ok && result.decision) {
      succeededCount += 1;

      if (result.decision.decision === "promising") {
        promisingCount += 1;
      } else if (result.decision.decision === "maybe") {
        maybeCount += 1;
      } else {
        skipCount += 1;
      }
    } else {
      failedCount += 1;
    }
  }

  return {
    totalDomains: results.length,
    succeededCount,
    failedCount,
    promisingCount,
    maybeCount,
    skipCount,
  };
}

export function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) {
    return `${ durationMs }ms`;
  }

  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${ seconds.toFixed(1) }s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${ minutes }m ${ remainingSeconds }s`;
}
