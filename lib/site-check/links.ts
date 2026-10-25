import { extractHostname } from "@/lib/search-plan/domain";

const IGNORED_HOST_SUFFIXES = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "pinterest.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "reddit.com",
  "threads.net",
  "bsky.app",
  "t.co",
  "feedburner.com",
  "feedblitz.com",
  "gravatar.com",
  "wp.com",
  "disqus.com",
  "google.com",
  "doubleclick.net",
  "apple.com",
  "spotify.com",
  "patreon.com",
];

function hostMatchesSuffix(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${ suffix }`);
}

const MIN_SITE_NAME_LENGTH_FOR_MATCH = 5;

export function isSameSite(hostname: string, siteDomain: string): boolean {
  const site = siteDomain.replace(/^www\./i, "").toLowerCase();
  if (hostMatchesSuffix(hostname, site) || hostMatchesSuffix(site, hostname)) {
    return true;
  }

  // Feeds can reference the site's own CDN or hosting hostnames, e.g. laughingsquid-com.<host>.net.
  const siteName = site.split(".")[0];
  return siteName.length >= MIN_SITE_NAME_LENGTH_FOR_MATCH && hostname.includes(siteName);
}

export function collectOutboundDomains(
  hrefs: string[],
  siteDomain: string,
): string[] {
  const domains = new Set<string>();

  for (const href of hrefs) {
    if (!/^https?:\/\//i.test(href)) {
      continue;
    }

    const hostname = extractHostname(href);
    if (!hostname || isSameSite(hostname, siteDomain)) {
      continue;
    }

    if (IGNORED_HOST_SUFFIXES.some((suffix) => hostMatchesSuffix(hostname, suffix))) {
      continue;
    }

    domains.add(hostname);
  }

  return [...domains];
}
