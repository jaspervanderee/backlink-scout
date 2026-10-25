import { DOMParser, parseHTML } from "linkedom";
import { fetchStaticPage } from "@/lib/fetch-and-extract/fetch-static";
import { collectOutboundDomains } from "./links";
import type { SitePost } from "./types";

const FEED_FETCH_TIMEOUT_MS = 10_000;
const MAX_FEED_POSTS = 15;
const MAX_EXCERPT_CHARS = 280;
const COMMON_FEED_PATHS = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml"];

type XmlElement = {
  tagName: string;
  textContent: string | null;
  children: ArrayLike<XmlElement>;
  getAttribute(name: string): string | null;
};

export function discoverFeedUrls(homepageHtml: string | null, homepageUrl: string): string[] {
  const urls: string[] = [];

  if (homepageHtml) {
    const { document } = parseHTML(homepageHtml);
    const alternates = document.querySelectorAll('link[rel="alternate"]');

    for (const link of alternates) {
      const type = link.getAttribute("type") ?? "";
      const href = link.getAttribute("href");
      if (!href || !/(rss|atom)\+xml/i.test(type)) {
        continue;
      }

      try {
        urls.push(new URL(href, homepageUrl).href);
      } catch {
        continue;
      }
    }
  }

  for (const path of COMMON_FEED_PATHS) {
    urls.push(new URL(path, homepageUrl).href);
  }

  return [...new Set(urls)].filter((url) => !/comments/i.test(url));
}

function childByTag(element: XmlElement, tagNames: string[]): XmlElement | null {
  for (const child of Array.from(element.children)) {
    if (tagNames.includes(child.tagName.toLowerCase())) {
      return child;
    }
  }

  return null;
}

function readItemLink(item: XmlElement): string {
  const rssLink = childByTag(item, ["link"]);
  const linkText = rssLink?.textContent?.trim();
  if (linkText) {
    return linkText;
  }

  for (const child of Array.from(item.children)) {
    if (child.tagName.toLowerCase() !== "link") {
      continue;
    }

    const rel = child.getAttribute("rel");
    const href = child.getAttribute("href");
    if (href && (!rel || rel === "alternate")) {
      return href;
    }
  }

  return "";
}

function readItemDate(item: XmlElement): string | null {
  const dateElement = childByTag(item, ["pubdate", "published", "updated", "dc:date"]);
  const raw = dateElement?.textContent?.trim();
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function summarizeItemContent(
  contentHtml: string,
  siteDomain: string,
): { excerpt: string; outboundDomains: string[] } {
  const { document } = parseHTML(`<!doctype html><html><body>${ contentHtml }</body></html>`);
  const hrefs = Array.from(document.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href") ?? "");
  const text = document.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";

  return {
    excerpt: text.slice(0, MAX_EXCERPT_CHARS),
    outboundDomains: collectOutboundDomains(hrefs, siteDomain),
  };
}

export function parseFeedPosts(xml: string, siteDomain: string): SitePost[] {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  const items = Array.from(document.querySelectorAll("item, entry")) as unknown as XmlElement[];

  return items.slice(0, MAX_FEED_POSTS).map((item) => {
    const contentElement = childByTag(item, ["content:encoded", "content", "description", "summary"]);
    const { excerpt, outboundDomains } = summarizeItemContent(
      contentElement?.textContent ?? "",
      siteDomain,
    );

    return {
      title: childByTag(item, ["title"])?.textContent?.trim() ?? "",
      url: readItemLink(item),
      publishedAt: readItemDate(item),
      excerpt,
      outboundDomains,
    };
  });
}

export async function readFeed(
  feedUrls: string[],
  siteDomain: string,
): Promise<{ feedUrl: string; posts: SitePost[] } | null> {
  for (const feedUrl of feedUrls) {
    try {
      const fetched = await fetchStaticPage(feedUrl, { timeoutMs: FEED_FETCH_TIMEOUT_MS });
      if (fetched.statusCode >= 400 || !/<(rss|feed|rdf:RDF)[\s>]/i.test(fetched.html)) {
        continue;
      }

      const posts = parseFeedPosts(fetched.html, siteDomain);
      if (posts.length > 0) {
        return { feedUrl: fetched.finalUrl, posts };
      }
    } catch {
      continue;
    }
  }

  return null;
}
