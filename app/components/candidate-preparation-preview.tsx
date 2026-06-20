"use client";

import { useState } from "react";
import { formatRemovalReason } from "@/lib/candidates/blocked-domains";
import type { PrepareCandidatesResult } from "@/lib/candidates/types";

type CandidatePreparationPreviewProps = {
  result: PrepareCandidatesResult;
};

export function CandidatePreparationPreview({
  result,
}: CandidatePreparationPreviewProps) {
  const [copied, setCopied] = useState(false);
  const { stats, kept, removed } = result;

  async function handleCopyJson() {
    const payload = { stats, kept, removed };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
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
            <h2 className="text-xl font-semibold">Prepared domain candidates</h2>
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
            <dt className="font-medium text-base-content/70">Total raw hits</dt>
            <dd>{stats.totalRawHits}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">
              Unique domains (before filtering)
            </dt>
            <dd>{stats.uniqueDomainsBeforeFiltering}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Kept domains</dt>
            <dd>{stats.keptDomainsCount}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Removed domains</dt>
            <dd>{stats.removedDomainsCount}</dd>
          </div>
        </dl>

        <section className="space-y-4">
          <h3 className="font-medium">Kept domain candidates</h3>
          {kept.length === 0 ? (
            <p className="text-sm text-base-content/70">No kept domain candidates.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {kept.map((candidate) => (
                <article
                  key={candidate.domain}
                  className="rounded-box border border-base-300 p-4"
                >
                  <p className="font-medium">{candidate.domain}</p>
                  <p className="mt-2 text-sm leading-6">
                    <a
                      href={candidate.representativeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="link link-primary"
                    >
                      {candidate.representativeTitle || candidate.representativeUrl}
                    </a>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {candidate.sourceQueryIds.map((queryId) => (
                      <span key={queryId} className="badge badge-neutral">
                        {queryId}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="font-medium">Removed domain candidates</h3>
          {removed.length === 0 ? (
            <p className="text-sm text-base-content/70">No removed domain candidates.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {removed.map((candidate) => (
                <article
                  key={`${ candidate.domain }-${ candidate.removalReason }-${ candidate.representativeUrl }`}
                  className="rounded-box border border-error/30 bg-error/5 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{candidate.domain}</p>
                    <span className="badge badge-error badge-outline">
                      {formatRemovalReason(candidate.removalReason)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6">
                    <a
                      href={candidate.representativeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="link link-primary"
                    >
                      {candidate.representativeTitle || candidate.representativeUrl}
                    </a>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {candidate.sourceQueryIds.map((queryId) => (
                      <span key={queryId} className="badge badge-neutral">
                        {queryId}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
