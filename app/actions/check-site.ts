"use server";

import { checkSite as runCheckSite } from "@/lib/site-check/check-site";
import { buildProjectContext as runBuildProjectContext } from "@/lib/site-check/project-context";
import type { SiteCheckResult } from "@/lib/site-check/types";

export async function buildProjectContext(urls: string[]): Promise<string> {
  const validURLs = urls.map((url) => url.trim()).filter(Boolean);
  return runBuildProjectContext(validURLs);
}

export async function checkSite(domain: string, projectContext: string): Promise<SiteCheckResult> {
  return runCheckSite(domain, projectContext);
}
