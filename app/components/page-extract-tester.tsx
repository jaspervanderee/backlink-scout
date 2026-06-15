"use client";

import { useState, useTransition } from "react";
import { extractPage } from "@/app/actions/extract-page";
import type { FetchAndExtractResult } from "@/lib/fetch-and-extract";

const REASON_LABELS: Record<string, string> = {
  blocked: "Blocked",
  too_thin: "Too little text",
  invalid_url: "Invalid URL",
  fetch_failed: "Fetch failed",
  timeout: "Timed out",
  parse_failed: "Could not parse",
  response_too_large: "Page too large",
};

export function PageExtractTester() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<FetchAndExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        setResult(await extractPage(url));
      } catch (caught) {
        setResult(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong while extracting the page.",
        );
      }
    });
  }

  const content = result
    ? result.ok
      ? result.contentMarkdown
      : result.contentMarkdown ?? result.contentText ?? ""
    : "";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Backlink Scout</h1>
        <p className="max-w-2xl text-base text-base-content/70">
          Submit a project URL to fetch and preview the readable page content.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card bg-base-100 border border-base-300">
        <div className="card-body gap-4">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium">Project URL</span>
            </div>
            <input
              type="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onFocus={(event) => {
                event.currentTarget.placeholder = "";
              }}
              onBlur={(event) => {
                if (!event.currentTarget.value) {
                  event.currentTarget.placeholder = "https://example.com";
                }
              }}
              placeholder="https://example.com"
              className="input input-bordered w-full"
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Reading page…
              </>
            ) : (
              "Read page"
            )}
          </button>
        </div>
      </form>

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`badge ${result.ok ? "badge-success" : "badge-warning"}`}>
              {result.ok ? "Ready" : REASON_LABELS[result.reason] ?? result.reason}
            </span>
            {result.statusCode ? (
              <span className="badge badge-outline">HTTP {result.statusCode}</span>
            ) : null}
          </div>

          {!result.ok ? (
            <div role="alert" className="alert alert-warning">
              <span>{result.message}</span>
            </div>
          ) : null}

          {result.metadata ? (
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body gap-3 text-sm">
                <h2 className="card-title text-base">Page details</h2>
                <dl className="grid gap-2">
                  <div>
                    <dt className="font-medium text-base-content/60">Title</dt>
                    <dd>{result.metadata.title ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-base-content/60">Description</dt>
                    <dd>{result.metadata.description ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-base-content/60">Final URL</dt>
                    <dd className="break-all">{result.finalUrl ?? "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          {content ? (
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body gap-3">
                <h2 className="card-title text-base">Extracted content</h2>
                <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-box bg-base-200 p-4 text-sm leading-6">
                  {content}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
