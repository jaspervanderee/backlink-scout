"use client";

import { useState, useTransition } from "react";
import { createProspectingBrief } from "@/app/actions/create-brief";
import { executeSearchPlan } from "@/app/actions/execute-search-plan";
import { generateSearchPlan } from "@/app/actions/generate-search-plan";
import { SearchPlanPreview } from "@/app/components/search-plan-preview";
import { SearchResultsPreview } from "@/app/components/search-results-preview";
import type { SearchQueryResultGroup } from "@/lib/perplexity/types";
import type { SearchPlan } from "@/lib/search-plan/types";

type FlowPhase =
  | "idle"
  | "loading"
  | "briefReady"
  | "searchPlanLoading"
  | "searchPlanReady"
  | "searchExecutionLoading"
  | "searchResultsReady"
  | "error";

export function ProspectingFlow() {
  const [url, setUrl] = useState("");
  const [brief, setBrief] = useState("");
  const [searchPlan, setSearchPlan] = useState<SearchPlan | null>(null);
  const [searchPlanWarnings, setSearchPlanWarnings] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchQueryResultGroup[] | null>(
    null,
  );
  const [searchExecutionWarnings, setSearchExecutionWarnings] = useState<string[]>(
    [],
  );
  const [searchExecutionError, setSearchExecutionError] = useState<string | null>(
    null,
  );
  const [phase, setPhase] = useState<FlowPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function clearSearchExecutionState() {
    setSearchResults(null);
    setSearchExecutionWarnings([]);
    setSearchExecutionError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setBrief("");
    setSearchPlan(null);
    setSearchPlanWarnings([]);
    clearSearchExecutionState();
    setPhase("loading");

    startTransition(async () => {
      try {
        const result = await createProspectingBrief(url);

        if (!result.ok) {
          setPhase("error");
          setErrorMessage(result.message);
          return;
        }

        setBrief(result.brief);
        setPhase("briefReady");
      } catch (caught) {
        setPhase("error");
        setErrorMessage(
          caught instanceof Error
            ? caught.message
            : "Something went wrong while generating the brief.",
        );
      }
    });
  }

  function handleContinue() {
    if (!brief.trim()) {
      return;
    }

    setErrorMessage(null);
    setSearchPlan(null);
    setSearchPlanWarnings([]);
    clearSearchExecutionState();
    setPhase("searchPlanLoading");

    startTransition(async () => {
      try {
        const result = await generateSearchPlan(brief, url);

        if (!result.ok) {
          setPhase("error");
          setErrorMessage(result.message);
          return;
        }

        setSearchPlan(result.plan);
        setSearchPlanWarnings(result.warnings);
        setPhase("searchPlanReady");
      } catch (caught) {
        setPhase("error");
        setErrorMessage(
          caught instanceof Error
            ? caught.message
            : "Something went wrong while generating the search plan.",
        );
      }
    });
  }

  function handleRunSearches() {
    if (!searchPlan) {
      return;
    }

    setSearchExecutionError(null);
    setSearchResults(null);
    setSearchExecutionWarnings([]);
    setPhase("searchExecutionLoading");

    startTransition(async () => {
      try {
        const result = await executeSearchPlan(searchPlan);

        if (!result.ok) {
          setSearchExecutionError(result.message);

          if (result.groups.length > 0) {
            setSearchResults(result.groups);
            setSearchExecutionWarnings([]);
            setPhase("searchResultsReady");
            return;
          }

          setPhase("searchPlanReady");
          return;
        }

        setSearchResults(result.groups);
        setSearchExecutionWarnings(result.warnings);
        setPhase("searchResultsReady");
      } catch (caught) {
        setSearchExecutionError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong while running Perplexity searches.",
        );
        setPhase("searchPlanReady");
      }
    });
  }

  const isBriefPhase =
    phase === "briefReady" ||
    phase === "searchPlanLoading" ||
    phase === "searchPlanReady" ||
    phase === "searchExecutionLoading" ||
    phase === "searchResultsReady";

  const isSearchPlanPhase =
    searchPlan !== null &&
    (phase === "searchPlanReady" ||
      phase === "searchExecutionLoading" ||
      phase === "searchResultsReady");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Backlink Scout</h1>
        <p className="max-w-2xl text-base text-base-content/70">
          Submit a project URL to generate an editable prospecting brief from the
          page content.
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
                {phase === "loading" ? "Analyzing project…" : "Working…"}
              </>
            ) : (
              "Analyze project"
            )}
          </button>
        </div>
      </form>

      {isPending && phase === "loading" ? (
        <p className="text-sm text-base-content/70">
          Reading page and writing prospecting brief…
        </p>
      ) : null}

      {isPending && phase === "searchPlanLoading" ? (
        <p className="text-sm text-base-content/70">Generating search plan…</p>
      ) : null}

      {isPending && phase === "searchExecutionLoading" ? (
        <p className="text-sm text-base-content/70">Running Perplexity searches…</p>
      ) : null}

      {errorMessage ? (
        <div role="alert" className="alert alert-error">
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {isBriefPhase ? (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body gap-4">
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text font-medium">Prospecting brief</span>
              </div>
              <textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                className="textarea textarea-bordered min-h-96 w-full leading-6"
              />
            </label>

            <button
              type="button"
              className="btn btn-primary w-full sm:w-auto"
              disabled={isPending || !brief.trim()}
              onClick={handleContinue}
            >
              {isPending && phase === "searchPlanLoading" ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Generating search plan…
                </>
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </div>
      ) : null}

      {isSearchPlanPhase && searchPlan ? (
        <>
          <SearchPlanPreview plan={searchPlan} warnings={searchPlanWarnings} />

          <div className="flex flex-col gap-4">
            <button
              type="button"
              className="btn btn-primary w-full sm:w-auto"
              disabled={isPending}
              onClick={handleRunSearches}
            >
              {isPending && phase === "searchExecutionLoading" ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Running Perplexity searches…
                </>
              ) : (
                "Run searches"
              )}
            </button>

            {searchExecutionError ? (
              <div role="alert" className="alert alert-error">
                <span>{searchExecutionError}</span>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {searchResults ? (
        <SearchResultsPreview
          groups={searchResults}
          warnings={searchExecutionWarnings}
        />
      ) : null}
    </div>
  );
}
