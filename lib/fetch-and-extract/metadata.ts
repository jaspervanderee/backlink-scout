import type { Document } from "linkedom";
import type { PageLink, PageMetadata } from "./types";

function getMetaContent(
  document: Document,
  selector: string,
): string | null {
  const element = document.querySelector(selector);
  const content = element?.getAttribute("content")?.trim();
  return content || null;
}

function getCanonical(document: Document, baseUrl: string): string | null {
  const href = document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute("href")
    ?.trim();

  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function collectOpenGraph(document: Document): Record<string, string> {
  const openGraph: Record<string, string> = {};

  for (const meta of document.querySelectorAll("meta[property]")) {
    const property = meta.getAttribute("property")?.trim();
    const content = meta.getAttribute("content")?.trim();

    if (!property || !content || !property.startsWith("og:")) {
      continue;
    }

    openGraph[property] = content;
  }

  return openGraph;
}

function collectLinks(
  root: ParentNode,
  baseUrl: string,
  limit = 100,
): PageLink[] {
  const links: PageLink[] = [];
  const seen = new Set<string>();

  for (const anchor of root.querySelectorAll("a[href]")) {
    const hrefValue = anchor.getAttribute("href")?.trim();
    if (!hrefValue || hrefValue.startsWith("#")) {
      continue;
    }

    let href: string;
    try {
      href = new URL(hrefValue, baseUrl).href;
    } catch {
      continue;
    }

    if (seen.has(href)) {
      continue;
    }

    seen.add(href);
    links.push({
      href,
      text: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "",
    });

    if (links.length >= limit) {
      break;
    }
  }

  return links;
}

export function extractMetadata(
  document: Document,
  baseUrl: string,
  contentRoot?: ParentNode | null,
): PageMetadata {
  const title =
    document.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim() ??
    null;

  const description =
    getMetaContent(document, 'meta[name="description"]') ??
    getMetaContent(document, 'meta[property="og:description"]');

  return {
    title,
    description,
    canonical: getCanonical(document, baseUrl),
    openGraph: collectOpenGraph(document),
    links: collectLinks(contentRoot ?? document.body ?? document, baseUrl),
  };
}
