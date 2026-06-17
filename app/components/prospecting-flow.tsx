"use client";

import { useState, useTransition } from "react";
import { createProspectingBrief } from "@/app/actions/create-brief";

type FlowPhase = "idle" | "loading" | "briefReady" | "error";

export function ProspectingFlow() {
  const [url, setUrl] = useState("");
  const [brief, setBrief] = useState("");
  const [phase, setPhase] = useState<FlowPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setBrief("");
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

      {errorMessage ? (
        <div role="alert" className="alert alert-error">
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {phase === "briefReady" ? (
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

            <button type="button" className="btn btn-primary w-full sm:w-auto">
              Continue
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
