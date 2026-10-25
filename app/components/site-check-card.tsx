"use client";

import { PitchDraftEditor } from "@/app/components/pitch-draft-editor";
import type { ContactedSite } from "@/lib/outreach-sheet/types";
import type { SiteCheck, SiteLean } from "@/lib/site-check/types";

type SiteCheckCardProps = {
  check: SiteCheck;
  contacted: ContactedSite[];
  tabTitle: string;
  onLogged: (site: ContactedSite) => void;
};

const LEAN_BADGES: Record<SiteLean, string> = {
  good: "badge-success",
  unsure: "badge-warning",
  poor: "badge-error",
};

function describeContact(site: ContactedSite): string {
  const details = [site.tab, site.outreachDate, site.outcome || site.status].filter(Boolean);
  return details.join(" · ");
}

function formatDate(isoDate: string | null): string {
  return isoDate ? isoDate.slice(0, 10) : "unknown";
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-base-content/60">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function SiteCheckCard({ check, contacted, tabTitle, onLogged }: SiteCheckCardProps) {
  const { evidence, summary, draft } = check;
  const leanBadge = summary ? LEAN_BADGES[summary.lean] : "badge-ghost";
  const leanLabel = summary?.lean ?? "no summary";
  const submission = summary?.submission;
  const siteURL = `https://${ check.domain }`;
  const mailtoAddress = draft?.to ? `mailto:${ draft.to }` : "";
  const submissionPageURL = evidence.submissionPage?.url ?? evidence.routes[0]?.url ?? null;

  return (
    <article className="card border border-base-300 bg-base-100">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <a href={siteURL} target="_blank" rel="noreferrer" className="link font-medium">
            {check.domain}
          </a>
          <span className={`badge ${ leanBadge }`}>{leanLabel}</span>
        </div>

        {contacted.length > 0 ? (
          <div role="status" className="alert alert-info text-sm">
            <span>
              Already in your sheet:
              {contacted.map((site) => (
                <span key={describeContact(site)} className="block">{describeContact(site)}</span>
              ))}
            </span>
          </div>
        ) : null}

        {check.error ? (
          <div role="alert" className="alert alert-warning text-sm">
            <span>{check.error}</span>
          </div>
        ) : null}

        <dl className="flex flex-col gap-3">
          {submission ? (
            <DetailRow label="How to submit">
              {submission.method || "unknown"}
              {draft?.to ? (
                <a href={mailtoAddress} className="link link-primary ml-2">{draft.to}</a>
              ) : null}
            </DetailRow>
          ) : null}

          {submissionPageURL ? (
            <DetailRow label="Submission page">
              <a href={submissionPageURL} target="_blank" rel="noreferrer" className="link break-all">
                {submissionPageURL}
              </a>
            </DetailRow>
          ) : null}

          {submission && submission.materials.length > 0 ? (
            <DetailRow label="What to send">
              <ul className="flex flex-col gap-1">
                {submission.materials.map((item) => (
                  <li key={item}>☐ {item}</li>
                ))}
              </ul>
            </DetailRow>
          ) : null}
        </dl>

        {draft ? (
          <PitchDraftEditor domain={check.domain} draft={draft} tabTitle={tabTitle} onLogged={onLogged} />
        ) : null}

        {summary ? (
          <details className="collapse collapse-arrow border border-base-300">
            <summary className="collapse-title text-sm font-medium">Why this verdict</summary>
            <dl className="collapse-content flex flex-col gap-3">
              <DetailRow label="What they publish">
                {summary.topics}
                {summary.contentFormat ? <span className="text-base-content/60"> · {summary.contentFormat}</span> : null}
              </DetailRow>
              <DetailRow label="Outside work">
                <span className="font-medium">{summary.featuresOutsideWork}</span>
                {summary.featuresOutsideWorkNote ? ` — ${ summary.featuresOutsideWorkNote }` : null}
              </DetailRow>
              <DetailRow label="Active">
                Latest post {formatDate(evidence.latestPostAt)} · {evidence.postsLast90Days} posts in the last 90 days
              </DetailRow>
              <DetailRow label="Fit">{summary.fitNote}</DetailRow>
              {summary.angle ? <DetailRow label="Angle">{summary.angle}</DetailRow> : null}
              {summary.submission.rules.length > 0 ? (
                <DetailRow label="Rules">
                  <ul className="list-disc space-y-1 pl-5">
                    {summary.submission.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </DetailRow>
              ) : null}
              {evidence.notes.length > 0 ? <DetailRow label="Notes">{evidence.notes.join(" ")}</DetailRow> : null}
            </dl>
          </details>
        ) : null}
      </div>
    </article>
  );
}
