"use client";

import { useState } from "react";
import { logSentPitch } from "@/app/actions/outreach-sheet";
import { CopyButton } from "@/app/components/copy-button";
import type { ContactedSite } from "@/lib/outreach-sheet/types";
import type { PitchDraft } from "@/lib/pitch-draft/types";

type PitchDraftEditorProps = {
  domain: string;
  draft: PitchDraft;
  tabTitle: string;
  onLogged: (site: ContactedSite) => void;
};

type LogState = "idle" | "saving" | "saved";

function buildLoggedMessage(subject: string, body: string, fields: PitchDraft["formFields"]): string {
  const fieldLines = fields.map((field) => `${ field.label }: ${ field.value }`);
  const subjectLine = subject ? `Subject: ${ subject }` : "";
  return [subjectLine, body, ...fieldLines].filter(Boolean).join("\n\n");
}

function buildMailtoLink(address: string, subject: string, body: string): string {
  const query = new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20");
  return `mailto:${ address }?${ query }`;
}

export function PitchDraftEditor({ domain, draft, tabTitle, onLogged }: PitchDraftEditorProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [logState, setLogState] = useState<LogState>("idle");
  const [logError, setLogError] = useState<string | null>(null);
  const isForm = draft.channel === "form";

  async function handleMarkAsSent() {
    setLogState("saving");
    setLogError(null);

    const date = new Date().toISOString().slice(0, 10);
    const result = await logSentPitch({
      tabTitle,
      name: draft.siteName || domain,
      website: domain,
      email: draft.to ?? (isForm ? "form" : ""),
      message: buildLoggedMessage(subject, body, draft.formFields),
      date,
    });

    if (!result.ok) {
      setLogState("idle");
      setLogError(result.message);
      return;
    }

    setLogState("saved");
    onLogged({ domain, tab: tabTitle, name: draft.siteName, outreachDate: date, status: "sent", outcome: "" });
  }

  const saveLabel = tabTitle ? `Mark as sent → ${ tabTitle }` : "Mark as sent (choose a sheet tab)";

  return (
    <div className="flex flex-col gap-3 rounded-box border border-base-300 p-4">
      <p className="text-sm font-medium">{isForm ? "Form text" : "Email draft"}</p>
      {!isForm && draft.to ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-base-content/60">To</span>
          <span>{draft.to}</span>
          <a href={buildMailtoLink(draft.to, subject, body)} className="btn btn-ghost btn-xs">
            Open in email
          </a>
        </div>
      ) : null}

      {!isForm ? (
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-sm text-base-content/60">
            Subject
            <CopyButton text={subject} />
          </span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="input input-bordered input-sm w-full"
          />
        </label>
      ) : null}

      {draft.formFields.map((field) => (
        <div key={field.label} className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between text-base-content/60">
            {field.label}
            <CopyButton text={field.value} />
          </span>
          <p className="whitespace-pre-wrap">{field.value}</p>
        </div>
      ))}

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-sm text-base-content/60">
          Message
          <CopyButton text={body} />
        </span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="textarea textarea-bordered min-h-56 w-full text-sm leading-6"
        />
      </label>

      {logError ? (
        <div role="alert" className="alert alert-error text-sm">
          <span>{logError}</span>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-primary btn-sm w-full sm:w-auto"
        disabled={!tabTitle || logState !== "idle"}
        onClick={handleMarkAsSent}
      >
        {logState === "saving" ? <span className="loading loading-spinner loading-xs" /> : null}
        {logState === "saved" ? `Logged in ${ tabTitle }` : saveLabel}
      </button>
    </div>
  );
}
