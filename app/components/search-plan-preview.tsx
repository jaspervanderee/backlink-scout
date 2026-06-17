"use client";

import { useState } from "react";
import {
  formatQueriesAsJson,
  formatQueriesAsMarkdown,
} from "@/lib/search-plan/format";
import type { SearchPlan, SearchPlanPriority } from "@/lib/search-plan/types";

type SearchPlanPreviewProps = {
  plan: SearchPlan;
  warnings: string[];
};

type CopyFormat = "json" | "markdown";

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

export function SearchPlanPreview({ plan, warnings }: SearchPlanPreviewProps) {
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const { metadata } = plan;
  const excludedDomains =
    metadata.excludedDomains.length > 0
      ? metadata.excludedDomains.join(", ")
      : "—";

  async function handleCopy(format: CopyFormat) {
    const text =
      format === "json"
        ? formatQueriesAsJson(plan)
        : formatQueriesAsMarkdown(plan);

    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      window.setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      setCopiedFormat(null);
    }
  }

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">Generated search plan</h2>
            <span className="badge badge-outline">Developer preview</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => handleCopy("json")}
            >
              {copiedFormat === "json" ? "Copied JSON" : "Copy JSON"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => handleCopy("markdown")}
            >
              {copiedFormat === "markdown" ? "Copied Markdown" : "Copy Markdown"}
            </button>
          </div>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-base-content/70">Total queries</dt>
            <dd>{plan.queries.length}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Excluded domains</dt>
            <dd>{excludedDomains}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Language</dt>
            <dd>{metadata.searchLanguage}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Region</dt>
            <dd>{metadata.searchCountryRegion ?? "—"}</dd>
          </div>
        </dl>

        {warnings.length > 0 ? (
          <details className="collapse collapse-arrow border border-warning/30 bg-warning/10">
            <summary className="collapse-title min-h-0 py-3 text-sm font-medium">
              {warnings.length} quality warning{warnings.length === 1 ? "" : "s"}
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

        <section className="space-y-3">
          <h3 className="font-medium">Opportunity hypotheses</h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
            {plan.opportunityHypotheses.map((hypothesis) => (
              <li key={hypothesis}>{hypothesis}</li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <h3 className="font-medium">Queries</h3>
          <div className="flex flex-col gap-4">
            {plan.queries.map((query) => (
              <article
                key={query.id}
                className="rounded-box border border-base-300 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="badge badge-neutral">{query.id}</span>
                  <span className={priorityBadgeClass(query.priority)}>
                    {query.priority}
                  </span>
                </div>

                <p className="text-base font-medium leading-6">{query.queryText}</p>

                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-base-content/70">
                      Hypothesis used
                    </dt>
                    <dd className="leading-6">{query.hypothesisUsed}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-base-content/70">
                      Expected page type
                    </dt>
                    <dd>{query.expectedPageType}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-base-content/70">Rationale</dt>
                    <dd className="leading-6">{query.rationale}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-base-content/70">Risk</dt>
                    <dd className="leading-6">{query.riskNote}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-base-content/70">
                      Recommended result count
                    </dt>
                    <dd>{query.recommendedResultCount}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
