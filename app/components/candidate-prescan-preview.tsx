"use client";

import { useState } from "react";
import type { CandidatePrescanEntry, CandidatePrescanResult } from "@/lib/candidates/prescan";
import {
  formatMaybeCategory,
  formatSkipCategory,
} from "@/lib/candidates/prescan";

type CandidatePrescanPreviewProps = {
  result: CandidatePrescanResult;
};

function decisionBadgeClass(decision: CandidatePrescanEntry["decision"]): string {
  switch (decision) {
    case "investigate":
      return "badge-success";
    case "maybe":
      return "badge-warning";
    case "skip":
      return "badge-error";
  }
}

function PrescanEntryList({
  title,
  entries,
}: {
  title: string;
  entries: CandidatePrescanEntry[];
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h3 className="font-medium">
        {title} ({entries.length})
      </h3>
      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <article
            key={`${ entry.candidate.domain }-${ entry.decision }`}
            className="rounded-box border border-base-300 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{entry.candidate.domain}</p>
              <span className={`badge badge-outline ${ decisionBadgeClass(entry.decision) }`}>
                {entry.decision}
              </span>
              {entry.skipCategory ? (
                <span className="badge badge-neutral badge-outline">
                  {formatSkipCategory(entry.skipCategory)}
                </span>
              ) : null}
              {entry.maybeCategory ? (
                <span className="badge badge-neutral badge-outline">
                  {formatMaybeCategory(entry.maybeCategory)}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6">
              <a
                href={entry.candidate.representativeUrl}
                target="_blank"
                rel="noreferrer"
                className="link link-primary"
              >
                {entry.candidate.representativeTitle ||
                  entry.candidate.representativeUrl}
              </a>
            </p>
            <p className="mt-2 text-sm text-base-content/70">{entry.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CandidatePrescanPreview({
  result,
}: CandidatePrescanPreviewProps) {
  const [copied, setCopied] = useState(false);
  const investigate = result.entries.filter(
    (entry) => entry.decision === "investigate",
  );
  const maybe = result.entries.filter((entry) => entry.decision === "maybe");
  const skip = result.entries.filter((entry) => entry.decision === "skip");

  async function handleCopyJson() {
    const payload = {
      stats: result.stats,
      entries: result.entries,
      investigationCandidates: result.investigationCandidates,
    };

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
          <h2 className="text-xl font-semibold">Pre-scan</h2>

          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleCopyJson}
          >
            {copied ? "Copied JSON" : "Copy JSON"}
          </button>
        </div>

        <p className="text-sm text-base-content/70">
          {result.stats.inputCount} in → {result.stats.investigateCount} investigate,{" "}
          {result.stats.maybeCount} maybe, {result.stats.skipCount} skip
          {result.stats.linkProbeCount > 0
            ? ` (${ result.stats.linkProbeCount } link probes, ${ result.stats.linkProbeDemotions } demotions)`
            : ""}
        </p>

        <PrescanEntryList title="Investigate" entries={investigate} />
        <PrescanEntryList title="Maybe" entries={maybe} />
        <PrescanEntryList title="Skip" entries={skip} />
      </div>
    </div>
  );
}
