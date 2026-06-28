import { parseHTML } from "linkedom";
import { DEFAULT_USER_AGENT } from "@/lib/fetch-and-extract/constants";
import { extractMetadata } from "@/lib/fetch-and-extract/metadata";
import { fetchStaticPage } from "@/lib/fetch-and-extract/fetch-static";

export const PRESCAN_LINK_PROBE_TIMEOUT_MS = 8_000;
export const PRESCAN_LINK_PROBE_MAX_BYTES = 1_048_576;
export const PRESCAN_LINK_PROBE_CONCURRENCY = 4;

const SOCIAL_HOST_SUFFIXES = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "pinterest.com",
  "youtube.com",
  "tiktok.com",
];

export type OutsideLinkProbeResult = {
  ok: true;
  externalLinkCount: number;
  internalLinkCount: number;
  substantiveLinkCount: number;
  featuredLinksAllInternal: boolean;
};

export type OutsideLinkProbeFailure = {
  ok: false;
  reason: "invalid_url" | "fetch_failed" | "not_html";
};

export type OutsideLinkProbeOutcome =
  | OutsideLinkProbeResult
  | OutsideLinkProbeFailure;

function isSocialHost(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  return SOCIAL_HOST_SUFFIXES.some(
    (suffix) =>
      lowerHostname === suffix || lowerHostname.endsWith(`.${ suffix }`),
  );
}

export function isInternalHostname(hostname: string, siteDomain: string): boolean {
  const lowerHostname = hostname.toLowerCase();
  const lowerSiteDomain = siteDomain.toLowerCase();

  return (
    lowerHostname === lowerSiteDomain ||
    lowerHostname.endsWith(`.${ lowerSiteDomain }`)
  );
}

function isSubstantiveLink(text: string, href: string): boolean {
  const trimmedText = text.trim();

  if (trimmedText.length >= 4) {
    return true;
  }

  try {
    const pathname = new URL(href).pathname;
    return pathname.length > 1 && pathname !== "/";
  } catch {
    return false;
  }
}

export function classifyPageLinks(
  links: { href: string; text: string }[],
  pageUrl: string,
  siteDomain: string,
): {
  externalLinkCount: number;
  internalLinkCount: number;
  substantiveLinkCount: number;
  featuredLinksAllInternal: boolean;
} {
  let externalLinkCount = 0;
  let internalLinkCount = 0;
  let substantiveLinkCount = 0;

  for (const link of links) {
    let parsed: URL;
    try {
      parsed = new URL(link.href, pageUrl);
    } catch {
      continue;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      continue;
    }

    if (!isSubstantiveLink(link.text, parsed.href)) {
      continue;
    }

    substantiveLinkCount += 1;

    if (isSocialHost(parsed.hostname)) {
      continue;
    }

    if (isInternalHostname(parsed.hostname, siteDomain)) {
      internalLinkCount += 1;
      continue;
    }

    externalLinkCount += 1;
  }

  const featuredLinksAllInternal =
    substantiveLinkCount >= 3 &&
    externalLinkCount === 0 &&
    internalLinkCount >= 3;

  return {
    externalLinkCount,
    internalLinkCount,
    substantiveLinkCount,
    featuredLinksAllInternal,
  };
}

export async function probeOutsideLinks(
  url: string,
  siteDomain: string,
): Promise<OutsideLinkProbeOutcome> {
  let requestedUrl: string;
  try {
    requestedUrl = new URL(url).href;
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  try {
    const fetched = await fetchStaticPage(requestedUrl, {
      timeoutMs: PRESCAN_LINK_PROBE_TIMEOUT_MS,
      maxResponseBytes: PRESCAN_LINK_PROBE_MAX_BYTES,
      userAgent: DEFAULT_USER_AGENT,
    });

    if (fetched.statusCode >= 400) {
      return { ok: false, reason: "fetch_failed" };
    }

    const { document } = parseHTML(fetched.html);
    const metadata = extractMetadata(document, fetched.finalUrl);
    const counts = classifyPageLinks(metadata.links, fetched.finalUrl, siteDomain);

    return {
      ok: true,
      ...counts,
    };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
}
