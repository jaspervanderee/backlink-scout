"use client";

import { useEffect, useState, type FormEvent } from "react";
import { buildProjectContext, checkSite } from "@/app/actions/check-site";
import { readContactedSites } from "@/app/actions/outreach-sheet";
import { SiteCheckCard } from "@/app/components/site-check-card";
import { chooseSheetTab } from "@/lib/outreach-sheet/guess-tab";
import type { ContactedSite } from "@/lib/outreach-sheet/types";
import type { SiteCheck } from "@/lib/site-check/types";

const CONCURRENCY = 3;

function parseSiteList(text: string): string[] {
  const sites = text
    .split(/[\s,]+/)
    .map((site) => site.trim())
    .filter(Boolean);

  return [...new Set(sites)];
}

export function SiteCheckPanel() {
  const [printURL, setPrintURL] = useState("");
  const [guideURL, setGuideURL] = useState("");
  const [siteList, setSiteList] = useState("");
  const [checks, setChecks] = useState<SiteCheck[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [contactedSites, setContactedSites] = useState<ContactedSite[]>([]);
  const [tabTitles, setTabTitles] = useState<string[]>([]);
  const sheetTab = printURL.trim() ? chooseSheetTab(printURL, tabTitles) : "";

  useEffect(() => {
    readContactedSites().then((sheet) => {
      if (sheet.ok) {
        setTabTitles(sheet.tabs.map((tab) => tab.title));
        setContactedSites(sheet.contactedSites);
      }
    });
  }, []);

  function handleLogged(site: ContactedSite) {
    setContactedSites((current) => [...current, site]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sites = parseSiteList(siteList);
    if (sites.length === 0) {
      return;
    }

    setIsRunning(true);
    setChecks([]);
    setErrors([]);
    setCompletedCount(0);
    setTotalCount(sites.length);

    const [projectContext, sheet] = await Promise.all([
      buildProjectContext([guideURL, printURL]),
      readContactedSites(),
    ]);

    if (sheet.ok) {
      setContactedSites(sheet.contactedSites);
      setTabTitles(sheet.tabs.map((tab) => tab.title));
    } else {
      setContactedSites([]);
      setErrors((current) => [...current, `Outreach sheet: ${ sheet.message }`]);
    }

    let nextIndex = 0;

    async function worker() {
      while (nextIndex < sites.length) {
        const site = sites[nextIndex];
        nextIndex += 1;

        try {
          const result = await checkSite(site, projectContext);
          if (result.ok) {
            setChecks((current) => [...current, result.check]);
          } else {
            setErrors((current) => [...current, `${ site }: ${ result.message }`]);
          }
        } catch {
          setErrors((current) => [...current, `${ site }: the check failed unexpectedly.`]);
        }

        setCompletedCount((current) => current + 1);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    setIsRunning(false);
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold sm:text-3xl">Site check</h2>
        <p className="max-w-2xl text-base text-base-content/70">
          Paste sites you are considering. Each one gets a verdict, the submission route and a draft to edit.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card border border-base-300 bg-base-100">
        <div className="card-body gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text font-medium">Print URL</span>
              </div>
              <input
                type="url"
                required
                value={printURL}
                onChange={(event) => setPrintURL(event.target.value)}
                placeholder="https://www.breen.studio/shop/…"
                className="input input-bordered w-full"
              />
            </label>

            <label className="form-control w-full">
              <div className="label">
                <span className="label-text font-medium">Blog post URL (optional)</span>
              </div>
              <input
                type="url"
                value={guideURL}
                onChange={(event) => setGuideURL(event.target.value)}
                placeholder="https://www.breen.studio/blog/…"
                className="input input-bordered w-full"
              />
            </label>
          </div>

          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium">Sites to check (one per line)</span>
            </div>
            <textarea
              required
              value={siteList}
              onChange={(event) => setSiteList(event.target.value)}
              placeholder={"laughingsquid.com\nitsnicethat.com"}
              className="textarea textarea-bordered min-h-32 w-full leading-6"
            />
          </label>

          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={isRunning}>
            {isRunning ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Checking {completedCount} of {totalCount}…
              </>
            ) : (
              "Check sites"
            )}
          </button>
        </div>
      </form>

      {errors.length > 0 ? (
        <div role="alert" className="alert alert-error">
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {checks.map((check) => (
          <SiteCheckCard
            key={check.domain}
            check={check}
            contacted={contactedSites.filter((site) => site.domain === check.domain)}
            tabTitle={sheetTab}
            onLogged={handleLogged}
          />
        ))}
      </div>
    </section>
  );
}
