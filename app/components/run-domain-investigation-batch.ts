"use client";

import { investigateDomain } from "@/app/actions/investigate-domain";
import type { KeptDomainCandidate } from "@/lib/candidates/types";
import { INVESTIGATION_DOMAIN_CONCURRENCY } from "@/lib/domain-investigation/config";
import type {
  DomainInvestigationProgress,
  DomainInvestigationResult,
} from "@/lib/domain-investigation/types";
import type { SearchQueryResultGroup } from "@/lib/perplexity/types";
import type { SearchPlan } from "@/lib/search-plan/types";

type RunDomainInvestigationBatchOptions = {
  brief: string;
  candidates: KeptDomainCandidate[];
  searchPlan: SearchPlan;
  searchResults: SearchQueryResultGroup[];
  concurrency?: number;
  onProgress: (progress: DomainInvestigationProgress) => void;
};

function createInitialProgress(total: number): DomainInvestigationProgress {
  return {
    total,
    completed: 0,
    inProgress: [],
    results: [],
    warnings: [],
    isRunning: true,
    error: null,
  };
}

export async function runDomainInvestigationBatch(
  options: RunDomainInvestigationBatchOptions,
): Promise<DomainInvestigationProgress> {
  const {
    brief,
    candidates,
    searchPlan,
    searchResults,
    concurrency = INVESTIGATION_DOMAIN_CONCURRENCY,
    onProgress,
  } = options;

  const progress = createInitialProgress(candidates.length);
  onProgress(progress);

  if (candidates.length === 0) {
    return {
      ...progress,
      isRunning: false,
      error: "No kept domain candidates to investigate.",
    };
  }

  const results: DomainInvestigationResult[] = new Array(candidates.length);
  const inProgress = new Set<string>();
  let nextIndex = 0;
  let completed = 0;
  const warnings: string[] = [];

  function publish() {
    onProgress({
      total: candidates.length,
      completed,
      inProgress: [...inProgress],
      results: results.filter((result) => result !== undefined),
      warnings: [...warnings],
      isRunning: completed < candidates.length,
      error: null,
    });
  }

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= candidates.length) {
        break;
      }

      const candidate = candidates[currentIndex];
      inProgress.add(candidate.domain);
      publish();

      try {
        const response = await investigateDomain(
          brief,
          candidate,
          searchPlan,
          searchResults,
        );

        if (!response.ok) {
          warnings.push(`${ candidate.domain }: ${ response.message }`);
          results[currentIndex] = {
            domain: candidate.domain,
            ok: false,
            input: {
              brief: brief.trim(),
              candidate,
              searchQueryContext: [],
            },
            siteSearch: null,
            readPages: null,
            decision: null,
            trace: {
              siteSearchQuery: "",
              siteSearchUsedFallback: false,
              readPageUrls: [],
              steps: [],
            },
            timing: {
              totalMs: 0,
              llmMs: 0,
              siteSearchMs: 0,
              readPagesMs: 0,
            },
            warnings: [],
            error: response.message,
          };
        } else {
          results[currentIndex] = response.result;

          if (!response.result.ok) {
            warnings.push(
              `${ candidate.domain }: ${ response.result.error ?? "failed" }`,
            );
          }

          if (response.result.warnings.length > 0) {
            for (const warning of response.result.warnings) {
              warnings.push(`${ candidate.domain }: ${ warning }`);
            }
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Domain investigation failed unexpectedly.";

        warnings.push(`${ candidate.domain }: ${ message }`);
        results[currentIndex] = {
          domain: candidate.domain,
          ok: false,
          input: {
            brief: brief.trim(),
            candidate,
            searchQueryContext: [],
          },
          siteSearch: null,
          readPages: null,
          decision: null,
          trace: {
            siteSearchQuery: "",
            siteSearchUsedFallback: false,
            readPageUrls: [],
            steps: [],
          },
          timing: {
            totalMs: 0,
            llmMs: 0,
            siteSearchMs: 0,
            readPagesMs: 0,
          },
          warnings: [],
          error: message,
        };
      }

      inProgress.delete(candidate.domain);
      completed += 1;
      publish();
    }
  }

  const workerCount = Math.min(concurrency, candidates.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const finalProgress: DomainInvestigationProgress = {
    total: candidates.length,
    completed,
    inProgress: [],
    results: results.filter((result) => result !== undefined),
    warnings,
    isRunning: false,
    error:
      completed > 0 && results.every((result) => !result?.ok)
        ? "No domain investigations produced a valid decision."
        : null,
  };

  onProgress(finalProgress);
  return finalProgress;
}
