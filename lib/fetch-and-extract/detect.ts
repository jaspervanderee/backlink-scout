import { BLOCKED_PAGE_PATTERNS } from "./constants";

export function isBlockedPage(html: string, statusCode: number): boolean {
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    return true;
  }

  const sample = html.slice(0, 20_000).toLowerCase();
  return BLOCKED_PAGE_PATTERNS.some((pattern) => pattern.test(sample));
}

export function isThinContent(
  contentText: string,
  minContentLength: number,
): boolean {
  const normalized = contentText.replace(/\s+/g, " ").trim();
  return normalized.length < minContentLength;
}
