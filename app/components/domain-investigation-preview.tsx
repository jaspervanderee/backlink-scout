"use client";

import { useState } from "react";
import { buildInvestigationStats, formatDurationMs } from "@/lib/domain-investigation/stats";
import type {
  DomainInvestigationProgress,
  DomainInvestigationResult,
  OpportunityType,
} from "@/lib/domain-investigation/types";

type DomainInvestigationPreviewProps = {
  progress: DomainInvestigationProgress;
};

function formatDecisionBadge(decision: string): string {
  if (decision === "promising") {
    return "badge-success";
  }

  if (decision === "maybe") {
    return "badge-warning";
  }

  return "badge-ghost";
}

function formatOpportunityType(value: OpportunityType): string {
  const labels: Record<OpportunityType, string> = {
    existing_inclusion: "Existing inclusion",
    resource_listing: "Resource / listing",
    roundup_guide: "Roundup / guide",
    editorial_feature: "Editorial feature",
    newsletter_blog_pitch: "Newsletter / blog pitch",
    not_a_fit: "Not a fit",
  };

  return labels[value];
}

function collectToolIssues(result: DomainInvestigationResult): string[] {
  const issues: string[] = [];

  if (result.siteSearch && !result.siteSearch.ok) {
    issues.push(`site_search: ${ result.siteSearch.error ?? "failed" }`);
  }

  if (result.siteSearch?.usedFallbackQuery) {
    issues.push("site_search: used fallback query");
  }

  if (result.readPages) {
    for (const page of result.readPages.pages) {
      if (!page.ok) {
        const reason = page.reason ?? "unknown";
        issues.push(`read_pages (${ page.requestedUrl }): ${ reason }`);
      }
    }
  }

  return issues;
}

function DomainResultCard({
  domainResult,
}: {
  domainResult: DomainInvestigationResult;
}) {
  const decision = domainResult.decision;
  const toolIssues = collectToolIssues(domainResult);
  const timing = domainResult.timing;

  return (
    <article className="rounded-box border border-base-300 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{domainResult.domain}</p>
        {decision ? (
          <>
            <span className={`badge ${ formatDecisionBadge(decision.decision) }`}>
              {decision.decision}
            </span>
            <span className="badge badge-outline">
              {decision.confidence} confidence
            </span>
            <span className="badge badge-neutral badge-outline">
              {formatOpportunityType(decision.opportunityType)}
            </span>
          </>
        ) : (
          <span className="badge badge-error badge-outline">failed</span>
        )}
      </div>

      <p className="mt-2 text-sm leading-6">
        <a
          href={domainResult.input.candidate.representativeUrl}
          target="_blank"
          rel="noreferrer"
          className="link link-primary"
        >
          {domainResult.input.candidate.representativeTitle ||
            domainResult.input.candidate.representativeUrl}
        </a>
      </p>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-medium text-base-content/70">Total</dt>
          <dd>{formatDurationMs(timing.totalMs)}</dd>
        </div>
        <div>
          <dt className="font-medium text-base-content/70">LLM calls</dt>
          <dd>{formatDurationMs(timing.llmMs)}</dd>
        </div>
        <div>
          <dt className="font-medium text-base-content/70">site_search</dt>
          <dd>{formatDurationMs(timing.siteSearchMs)}</dd>
        </div>
        <div>
          <dt className="font-medium text-base-content/70">read_pages</dt>
          <dd>{formatDurationMs(timing.readPagesMs)}</dd>
        </div>
      </dl>

      {decision ? (
        <div className="mt-4 space-y-3 text-sm leading-6">
          <div>
            <p className="font-medium">Fit rationale</p>
            <p>{decision.fitRationale}</p>
          </div>

          <div>
            <p className="font-medium">External-feature evidence</p>
            <p>{decision.externalFeatureEvidence}</p>
          </div>

          <div>
            <p className="font-medium">Evidence pages inspected</p>
            {decision.evidencePagesInspected.length === 0 ? (
              <p className="text-base-content/70">None listed.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {decision.evidencePagesInspected.map((pageUrl) => (
                  <li key={pageUrl}>
                    <a
                      href={pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="link link-primary"
                    >
                      {pageUrl}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="font-medium">Risk / conflict notes</p>
            <p>{decision.riskNotes}</p>
            <p className="mt-1 text-base-content/80">
              {decision.incentivesOrConflicts}
            </p>
          </div>

          <div>
            <p className="font-medium">Evidence gaps</p>
            <p>{decision.evidenceGaps}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-error">
          {domainResult.error ?? "Investigation failed."}
        </p>
      )}

      {toolIssues.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Extraction / search issues</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-base-content/80">
            {toolIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="collapse collapse-arrow mt-4 border border-base-300 bg-base-200/30">
        <summary className="collapse-title min-h-0 py-3 text-sm font-medium">
          Raw JSON / tool trace
        </summary>
        <div className="collapse-content">
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5">
            {JSON.stringify(
              {
                trace: domainResult.trace,
                timing: domainResult.timing,
                siteSearch: domainResult.siteSearch,
                readPages: domainResult.readPages,
                decision: domainResult.decision,
                warnings: domainResult.warnings,
                error: domainResult.error,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </details>
    </article>
  );
}

export function DomainInvestigationPreview({
  progress,
}: DomainInvestigationPreviewProps) {
  const [copied, setCopied] = useState(false);
  const stats = buildInvestigationStats(progress.results);
  const copyPayload = {
    stats,
    ...progress,
  };

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(copyPayload, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const progressLabel = progress.isRunning
    ? `${ progress.completed } of ${ progress.total } complete`
    : `Investigated ${ progress.completed } of ${ progress.total }`;

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">Domain investigation</h2>
            <span className="badge badge-outline">Developer preview</span>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleCopyJson}
          >
            {copied ? "Copied JSON" : "Copy JSON"}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{progressLabel}</p>
          {progress.isRunning ? (
            <span className="loading loading-spinner loading-sm" />
          ) : null}
          {progress.inProgress.length > 0 ? (
            <p className="text-sm text-base-content/70">
              In progress: {progress.inProgress.join(", ")}
            </p>
          ) : null}
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-medium text-base-content/70">Completed</dt>
            <dd>
              {progress.completed} / {progress.total}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Succeeded</dt>
            <dd>{stats.succeededCount}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Promising / maybe / skip</dt>
            <dd>
              {stats.promisingCount} / {stats.maybeCount} / {stats.skipCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Failed</dt>
            <dd>{stats.failedCount}</dd>
          </div>
        </dl>

        {progress.error ? (
          <div role="alert" className="alert alert-error">
            <span>{progress.error}</span>
          </div>
        ) : null}

        {progress.warnings.length > 0 ? (
          <details className="collapse collapse-arrow border border-warning/30 bg-warning/10">
            <summary className="collapse-title text-sm font-medium">
              Investigation warnings ({progress.warnings.length})
            </summary>
            <div className="collapse-content">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {progress.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </details>
        ) : null}

        <section className="space-y-4">
          <h3 className="font-medium">Investigated domains</h3>
          {progress.results.length === 0 ? (
            <p className="text-sm text-base-content/70">
              {progress.isRunning
                ? "Waiting for first domain result…"
                : "No investigation results."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {progress.results.map((domainResult) => (
                <DomainResultCard
                  key={domainResult.domain}
                  domainResult={domainResult}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
