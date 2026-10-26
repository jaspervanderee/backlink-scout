import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { extractMetadata } from "./metadata.ts";
import type { PageMetadata } from "./types.ts";

export type ExtractedContent = {
  metadata: PageMetadata;
  contentText: string;
  articleTitle: string | null;
};

export function extractReadableContent(
  html: string,
  pageUrl: string,
): ExtractedContent | null {
  const { document } = parseHTML(html);
  if (!document?.documentElement) {
    return null;
  }

  let article: ReturnType<Readability["parse"]> = null;
  try {
    article = new Readability(document, { charThreshold: 80 }).parse();
  } catch {
    article = null;
  }

  if (!article) {
    const metadata = extractMetadata(document, pageUrl);
    const fallbackText =
      document.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";

    if (!fallbackText) {
      return null;
    }

    return {
      metadata,
      contentText: fallbackText,
      articleTitle: metadata.title,
    };
  }

  // linkedom leaves body empty when parsing a bare fragment, so wrap it in a full document.
  const contentRoot = parseHTML(
    `<!doctype html><html><body>${ article.content ?? "" }</body></html>`,
  ).document.body;
  const metadata = extractMetadata(document, pageUrl, contentRoot);
  const contentText = (article.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    metadata: {
      ...metadata,
      title: article.title || metadata.title,
      description: article.excerpt || metadata.description,
      links: extractMetadata(document, pageUrl, contentRoot).links,
    },
    contentText,
    articleTitle: article.title || metadata.title,
  };
}
