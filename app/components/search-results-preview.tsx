"use client";

import { useState } from "react";
import type { SearchPlanPriority } from "@/lib/search-plan/types";
import type { SearchQueryResultGroup } from "@/lib/perplexity/types";

type SearchResultsPreviewProps = {
  groups: SearchQueryResultGroup[];
  warnings: string[];
};

function priorityBadgeClass(priority: SearchPlanPriority): string {
  switch (priority) {
    case "high":
      return "badge badge-success";
    case "medium":
      return "badge badge-warning";
    case "low":
      return "badge badge-ghost";
  }
}

function countRawResults(groups: SearchQueryResultGroup[]): number {
  let total = 0;

  for (const group of groups) {
    if (group.ok) {
      total += group.response.results.length;
    }
  }

  return total;
}

export function SearchResultsPreview({
  groups,
  warnings,
}: SearchResultsPreviewProps) {
  const [copied, setCopied] = useState(false);
  const successCount = groups.filter((group) => group.ok).length;
  const failureCount = groups.length - successCount;
  const rawResultCount = countRawResults(groups);

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(groups, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">Perplexity search results</h2>
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

        <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-medium text-base-content/70">Total queries</dt>
            <dd>{groups.length}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Succeeded</dt>
            <dd>{successCount}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Failed</dt>
            <dd>{failureCount}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Raw results</dt>
            <dd>{rawResultCount}</dd>
          </div>
        </dl>

        {warnings.length > 0 ? (
          <details className="collapse collapse-arrow border border-warning/30 bg-warning/10">
            <summary className="collapse-title min-h-0 py-3 text-sm font-medium">
              {warnings.length} query failure{warnings.length === 1 ? "" : "s"}
            </summary>
            <div className="collapse-content">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </details>
        ) : null}

        <section className="space-y-4">
          <h3 className="font-medium">Results by query</h3>
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <article
                key={group.query.id}
                className="rounded-box border border-base-300 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="badge badge-neutral">{group.query.id}</span>
                  <span className={priorityBadgeClass(group.query.priority)}>
                    {group.query.priority}
                  </span>
                  <span className="badge badge-outline">
                    max {group.requestedMaxResults}
                  </span>
                  {group.ok ? (
                    <span className="badge badge-success">ok</span>
                  ) : (
                    <span className="badge badge-error">failed</span>
                  )}
                </div>

                <p className="text-base font-medium leading-6">
                  {group.query.queryText}
                </p>

                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-base-content/70">
                      Hypothesis used
                    </dt>
                    <dd className="leading-6">{group.query.hypothesisUsed}</dd>
                  </div>
                </dl>

                {group.ok ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-base-content/70">
                      {group.response.results.length} result
                      {group.response.results.length === 1 ? "" : "s"} · response{" "}
                      {group.response.id || "—"}
                    </p>
                    <ol className="list-decimal space-y-3 pl-5 text-sm">
                      {group.response.results.map((result) => (
                        <li key={`${group.query.id}-${result.url}`} className="space-y-1">
                          <p className="font-medium leading-6">
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noreferrer"
                              className="link link-primary"
                            >
                              {result.title || result.url}
                            </a>
                          </p>
                          <p className="leading-6 text-base-content/80">
                            {result.snippet}
                          </p>
                          {result.date || result.lastUpdated ? (
                            <p className="text-xs text-base-content/60">
                              {result.date ? `Published ${result.date}` : null}
                              {result.date && result.lastUpdated ? " · " : null}
                              {result.lastUpdated
                                ? `Updated ${result.lastUpdated}`
                                : null}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div role="alert" className="alert alert-error mt-4 text-sm">
                    <span>{group.message}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
