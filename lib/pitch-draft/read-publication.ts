import { fetchAndExtract } from "../fetch-and-extract/index.ts";
import type { SiteCheckSummary, SiteEvidence } from "../site-check/types.ts";

const MAX_ARTICLES = 3;
const MAX_ARTICLE_CHARS = 2_500;
const MAX_ABOUT_CHARS = 2_500;
const PAGE_TIMEOUT_MS = 10_000;

export type PublicationPage = {
  title: string;
  url: string;
  text: string;
};

export type PublicationReading = {
  about: PublicationPage | null;
  articles: PublicationPage[];
};

async function readPage(url: string, maxChars: number): Promise<PublicationPage | null> {
  try {
    const extraction = await fetchAndExtract(url, { staticTimeoutMs: PAGE_TIMEOUT_MS });
    const text = (extraction.contentText ?? "").slice(0, maxChars);
    return text ? { title: extraction.metadata?.title ?? url, url, text } : null;
  } catch {
    return null;
  }
}

export async function readPublication(
  evidence: SiteEvidence,
  summary: SiteCheckSummary,
): Promise<PublicationReading> {
  const articleURLs = [summary.closestPrecedent?.url, ...evidence.posts.map((post) => post.url)]
    .filter((url): url is string => Boolean(url));
  const uniqueArticleURLs = [...new Set(articleURLs)].slice(0, MAX_ARTICLES);

  const [about, ...articles] = await Promise.all([
    evidence.aboutURL ? readPage(evidence.aboutURL, MAX_ABOUT_CHARS) : Promise.resolve(null),
    ...uniqueArticleURLs.map((url) => readPage(url, MAX_ARTICLE_CHARS)),
  ]);

  return {
    about,
    articles: articles.filter((article): article is PublicationPage => Boolean(article)),
  };
}
