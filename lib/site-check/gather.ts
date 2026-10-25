import { parseHTML } from "linkedom";
import { fetchAndExtract } from "@/lib/fetch-and-extract";
import { isBlockedPage } from "@/lib/fetch-and-extract/detect";
import { fetchStaticPage } from "@/lib/fetch-and-extract/fetch-static";
import type { PageLink } from "@/lib/fetch-and-extract/types";
import { buildFallbackSiteSearchQuery, runSiteSearch } from "@/lib/domain-investigation/site-search";
import { discoverFeedUrls, readFeed } from "./feed";
import { extractHostname } from "@/lib/search-plan/domain";
import { collectOutboundDomains } from "./links";
import { findProtectedEmails, findRoutes, readRoutePages } from "./routes";
import type { PostSource, SiteEvidence, SitePost } from "./types";

const HOMEPAGE_TIMEOUT_MS = 12_000;
const POST_PAGE_TIMEOUT_MS = 10_000;
const MAX_POST_PAGES_TO_READ = 4;
const MAX_SIMILAR_PAGES_TO_READ = 3;
const RECENT_WINDOW_DAYS = 90;
const MIN_TEXT_FOR_REAL_PAGE = 1_500;
const MIN_TEXT_FOR_LIVE_SITE = 200;
const ABOUT_TEXT_PATTERN = /^(about( us)?|who we are|our story)$/i;
const ABOUT_PATH_PATTERN = /\/(about|about-us|who-we-are)\/?$/i;
const MILLISECONDS_PER_DAY = 86_400_000;

type Homepage = {
  html: string | null;
  finalUrl: string;
  reachable: boolean;
  blocked: boolean;
  nearlyEmpty: boolean;
  title: string | null;
  description: string | null;
  links: PageLink[];
};

async function readHomepage(homepageUrl: string): Promise<Homepage> {
  try {
    const fetched = await fetchStaticPage(homepageUrl, { timeoutMs: HOMEPAGE_TIMEOUT_MS });
    const { document } = parseHTML(fetched.html);
    const text = document.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const blocked =
      isBlockedPage(fetched.html, fetched.statusCode) &&
      (fetched.statusCode >= 400 || text.length < MIN_TEXT_FOR_REAL_PAGE);

    const links: PageLink[] = [];
    for (const anchor of document.querySelectorAll("a[href]")) {
      const hrefValue = anchor.getAttribute("href")?.trim();
      if (!hrefValue || hrefValue.startsWith("#")) {
        continue;
      }

      try {
        const href = hrefValue.startsWith("mailto:")
          ? hrefValue
          : new URL(hrefValue, fetched.finalUrl).href;
        links.push({ href, text: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "" });
      } catch {
        continue;
      }
    }

    return {
      html: blocked ? null : fetched.html,
      finalUrl: fetched.finalUrl,
      reachable: fetched.statusCode < 400 || blocked,
      blocked,
      nearlyEmpty: !blocked && text.length < MIN_TEXT_FOR_LIVE_SITE,
      title: document.querySelector("title")?.textContent?.trim() ?? null,
      description:
        document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? null,
      links: blocked ? [] : links,
    };
  } catch {
    return {
      html: null,
      finalUrl: homepageUrl,
      reachable: false,
      blocked: false,
      nearlyEmpty: false,
      title: null,
      description: null,
      links: [],
    };
  }
}

async function searchPosts(domain: string, query: string): Promise<SitePost[]> {
  const siteSearch = await runSiteSearch(domain, query);

  return siteSearch.evidence.map((item) => ({
    title: item.title,
    url: item.url,
    publishedAt: item.date ?? item.lastUpdated,
    excerpt: item.snippet,
    outboundDomains: [],
  }));
}

function buildSimilarPostsQuery(domain: string): string {
  return `site:${ domain } art print poster infographic design featured`;
}

function buildRouteSearchQuery(domain: string): string {
  return `site:${ domain } submit tips contact get featured`;
}

async function addOutboundLinksFromPages(
  posts: SitePost[],
  domain: string,
  maxPages: number,
): Promise<SitePost[]> {
  const enriched = [...posts];

  for (let index = 0; index < Math.min(maxPages, enriched.length); index += 1) {
    const post = enriched[index];
    if (post.outboundDomains.length > 0 || !post.url) {
      continue;
    }

    try {
      const extraction = await fetchAndExtract(post.url, { staticTimeoutMs: POST_PAGE_TIMEOUT_MS });
      const hrefs = extraction.metadata?.links.map((link) => link.href) ?? [];
      enriched[index] = { ...post, outboundDomains: collectOutboundDomains(hrefs, domain) };
    } catch {
      continue;
    }
  }

  return enriched;
}

function findAboutURL(links: PageLink[], domain: string): string | null {
  const aboutLink = links.find((link) => {
    const hostname = extractHostname(link.href);
    const isSameDomain = hostname !== null && (hostname === domain || hostname.endsWith(`.${ domain }`));
    return isSameDomain && (ABOUT_TEXT_PATTERN.test(link.text) || ABOUT_PATH_PATTERN.test(link.href));
  });

  return aboutLink?.href ?? null;
}

function countRecentPosts(posts: SitePost[], now: Date): number {
  const cutoff = now.getTime() - RECENT_WINDOW_DAYS * MILLISECONDS_PER_DAY;
  return posts.filter((post) => post.publishedAt && Date.parse(post.publishedAt) >= cutoff).length;
}

function findLatestPostDate(posts: SitePost[]): string | null {
  const dates = posts
    .map((post) => post.publishedAt)
    .filter((date): date is string => Boolean(date))
    .sort();

  return dates.at(-1) ?? null;
}

export async function gatherSiteEvidence(requestedDomain: string, now = new Date()): Promise<SiteEvidence> {
  const notes: string[] = [];
  const homepage = await readHomepage(`https://${ requestedDomain }/`);
  const redirectedDomain = extractHostname(homepage.finalUrl);
  const domain = redirectedDomain && homepage.reachable ? redirectedDomain : requestedDomain;
  const homepageUrl = `https://${ domain }/`;

  if (domain !== requestedDomain) {
    notes.push(`Redirects to ${ domain }.`);
  }

  if (homepage.blocked) {
    notes.push("Site blocks automated visits; posts come from search results.");
  } else if (!homepage.reachable) {
    notes.push("Homepage could not be loaded.");
  } else if (homepage.nearlyEmpty) {
    notes.push("Homepage is nearly empty; the domain may be parked or only work with JavaScript.");
  }

  let postSource: PostSource = "none";
  let feedUrl: string | null = null;
  let posts: SitePost[] = [];

  const feed = homepage.blocked ? null : await readFeed(discoverFeedUrls(homepage.html, homepageUrl), domain);
  if (feed) {
    postSource = "feed";
    feedUrl = feed.feedUrl;
    posts = feed.posts;
  } else {
    posts = await searchPosts(domain, buildFallbackSiteSearchQuery(domain));
    postSource = posts.length > 0 ? "search" : "none";
    if (!homepage.blocked) {
      notes.push("No RSS feed found; posts come from search results.");
    }
  }

  if (!homepage.blocked && !posts.some((post) => post.outboundDomains.length > 0)) {
    posts = await addOutboundLinksFromPages(posts, domain, MAX_POST_PAGES_TO_READ);
  }

  const knownPostURLs = new Set(posts.map((post) => post.url));
  let similarPosts = (await searchPosts(domain, buildSimilarPostsQuery(domain)))
    .filter((post) => !knownPostURLs.has(post.url));

  if (!homepage.blocked) {
    similarPosts = await addOutboundLinksFromPages(similarPosts, domain, MAX_SIMILAR_PAGES_TO_READ);
  }

  let routeLinks = homepage.links;
  if (homepage.blocked) {
    const routeResults = await searchPosts(domain, buildRouteSearchQuery(domain));
    routeLinks = routeResults.map((result) => ({ href: result.url, text: result.title }));
    notes.push("Submission routes come from search results and were not opened.");
  }

  const { routes, emails: homepageEmails } = findRoutes(routeLinks, domain);
  const routePages = homepage.blocked
    ? { emails: [], paidSignals: [], submissionPage: null }
    : await readRoutePages(routes);

  return {
    domain: requestedDomain,
    homepageUrl,
    homepageReachable: homepage.reachable,
    homepageBlocked: homepage.blocked,
    homepageTitle: homepage.title,
    homepageDescription: homepage.description,
    postSource,
    feedUrl,
    posts,
    similarPosts,
    latestPostAt: findLatestPostDate(posts),
    postsLast90Days: countRecentPosts(posts, now),
    postsLinkingOut: posts.filter((post) => post.outboundDomains.length > 0).length,
    routes,
    emails: [...new Set([
      ...homepageEmails,
      ...findProtectedEmails(homepage.html ?? ""),
      ...routePages.emails,
    ])],
    paidSignals: routePages.paidSignals,
    submissionPage: routePages.submissionPage,
    aboutURL: findAboutURL(homepage.links, domain),
    notes,
  };
}
