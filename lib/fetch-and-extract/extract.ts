import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { extractMetadata } from "./metadata";
import type { PageMetadata } from "./types";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.addRule("preserveLinks", {
  filter: "a",
  replacement(content, node) {
    const href = (node as HTMLAnchorElement).getAttribute("href");
    const text = content.trim() || href || "";
    return href ? `[${text}](${href})` : text;
  },
});

export type ExtractedContent = {
  metadata: PageMetadata;
  contentMarkdown: string;
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
      contentMarkdown: fallbackText,
      contentText: fallbackText,
      articleTitle: metadata.title,
    };
  }

  // linkedom leaves body empty when parsing a bare fragment, so wrap it in a full document.
  const contentRoot = parseHTML(
    `<!doctype html><html><body>${ article.content ?? "" }</body></html>`,
  ).document.body;
  const metadata = extractMetadata(document, pageUrl, contentRoot);
  const contentMarkdown = turndown
    .turndown(article.content ?? "")
    .trim();
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
    contentMarkdown,
    contentText,
    articleTitle: article.title || metadata.title,
  };
}
