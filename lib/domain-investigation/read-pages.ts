import { fetchAndExtract } from "@/lib/fetch-and-extract";
import {
  INVESTIGATION_PAGE_FETCH_TIMEOUT_MS,
  INVESTIGATION_READ_PAGES_CONCURRENCY,
} from "./config";
import type { ReadPageResult, ReadPagesToolResult } from "./types";

const MAX_READ_PAGES = 5;
const MAX_PAGE_CONTENT_CHARS = 6_000;

function truncateContent(content: string): string {
  if (content.length <= MAX_PAGE_CONTENT_CHARS) {
    return content;
  }

  return `${ content.slice(0, MAX_PAGE_CONTENT_CHARS) }\n\n[truncated]`;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    deduped.push(trimmed);

    if (deduped.length >= MAX_READ_PAGES) {
      break;
    }
  }

  return deduped;
}

async function extractSinglePage(requestedUrl: string): Promise<ReadPageResult> {
  const extraction = await fetchAndExtract(requestedUrl, {
    staticTimeoutMs: INVESTIGATION_PAGE_FETCH_TIMEOUT_MS,
  });

  if (extraction.ok) {
    return {
      requestedUrl,
      ok: true,
      finalUrl: extraction.finalUrl,
      statusCode: extraction.statusCode,
      reason: null,
      message: null,
      metadata: extraction.metadata,
      contentMarkdown: truncateContent(extraction.contentMarkdown),
      contentText: truncateContent(extraction.contentText),
      links: extraction.metadata.links,
    };
  }

  return {
    requestedUrl,
    ok: false,
    finalUrl: extraction.finalUrl,
    statusCode: extraction.statusCode,
    reason: extraction.reason,
    message: extraction.message,
    metadata: extraction.metadata,
    contentMarkdown: extraction.contentMarkdown
      ? truncateContent(extraction.contentMarkdown)
      : "",
    contentText: extraction.contentText
      ? truncateContent(extraction.contentText)
      : "",
    links: extraction.metadata?.links ?? [],
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        break;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

export async function runReadPages(urls: string[]): Promise<ReadPagesToolResult> {
  const selectedUrls = dedupeUrls(urls);
  const pages = await mapWithConcurrency(
    selectedUrls,
    INVESTIGATION_READ_PAGES_CONCURRENCY,
    (requestedUrl) => extractSinglePage(requestedUrl),
  );

  return { pages };
}

export function countSuccessfulReadPages(result: ReadPagesToolResult): number {
  return result.pages.filter((page) => page.ok && page.contentText.trim().length > 0)
    .length;
}
