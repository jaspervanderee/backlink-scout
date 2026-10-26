import { isBlockedPage, isThinContent } from "./detect.ts";
import { extractReadableContent } from "./extract.ts";
import { fetchStaticPage } from "./fetch-static.ts";
import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MIN_CONTENT_LENGTH,
  DEFAULT_STATIC_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from "./constants.ts";
import type {
  FetchAndExtractFailure,
  FetchAndExtractOptions,
  FetchAndExtractResult,
  FetchFailureReason,
} from "./types.ts";

export type {
  FetchAndExtractFailure,
  FetchAndExtractOptions,
  FetchAndExtractResult,
  FetchAndExtractSuccess,
  FetchFailureReason,
  PageLink,
  PageMetadata,
} from "./types.ts";

function failure(
  partial: Partial<FetchAndExtractFailure> &
    Pick<
      FetchAndExtractFailure,
      "ok" | "requestedUrl" | "reason" | "message"
    >,
): FetchAndExtractFailure {
  return {
    finalUrl: null,
    statusCode: null,
    metadata: null,
    contentText: null,
    ...partial,
  };
}

function mapFetchError(error: unknown): {
  reason: FetchFailureReason;
  message: string;
} {
  if (error instanceof Error) {
    if (error.message === "timeout") {
      return {
        reason: "timeout",
        message: "The request timed out before the page could be fetched.",
      };
    }

    if (error.message === "response_too_large") {
      return {
        reason: "response_too_large",
        message: "The page response was larger than the allowed limit.",
      };
    }

    return { reason: "fetch_failed", message: error.message };
  }

  return {
    reason: "fetch_failed",
    message: "The page could not be fetched.",
  };
}

/**
 * Fetch one URL and return LLM-ready page content from that exact page.
 */
export async function fetchAndExtract(
  inputUrl: string,
  options: FetchAndExtractOptions = {},
): Promise<FetchAndExtractResult> {
  const staticTimeoutMs = options.staticTimeoutMs ?? DEFAULT_STATIC_TIMEOUT_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const minContentLength =
    options.minContentLength ?? DEFAULT_MIN_CONTENT_LENGTH;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  let requestedUrl: string;
  try {
    requestedUrl = new URL(inputUrl).href;
  } catch {
    return failure({
      ok: false,
      requestedUrl: inputUrl,
      reason: "invalid_url",
      message: "Enter a valid URL, including https://",
    });
  }

  let fetched;
  try {
    fetched = await fetchStaticPage(requestedUrl, {
      timeoutMs: staticTimeoutMs,
      maxResponseBytes,
      userAgent,
    });
  } catch (error) {
    const mapped = mapFetchError(error);
    return failure({
      ok: false,
      requestedUrl,
      reason: mapped.reason,
      message: mapped.message,
    });
  }

  const extracted = extractReadableContent(fetched.html, fetched.finalUrl);

  if (!extracted) {
    return failure({
      ok: false,
      requestedUrl,
      finalUrl: fetched.finalUrl,
      statusCode: fetched.statusCode,
      reason: "parse_failed",
      message:
        "The page HTML could not be converted into readable content. Try a page with more visible text.",
      metadata: null,
      contentText: null,
    });
  }

  const blocked = isBlockedPage(fetched.html, fetched.statusCode);
  const thin = isThinContent(extracted.contentText, minContentLength);

  if (blocked) {
    return failure({
      ok: false,
      requestedUrl,
      finalUrl: fetched.finalUrl,
      statusCode: fetched.statusCode,
      reason: "blocked",
      message:
        "This page blocked automated access or requires interaction. Try a different URL or enter a project summary manually.",
      metadata: extracted.metadata,
      contentText: extracted.contentText,
    });
  }

  if (thin) {
    return failure({
      ok: false,
      requestedUrl,
      finalUrl: fetched.finalUrl,
      statusCode: fetched.statusCode,
      reason: "too_thin",
      message:
        "This page has too little readable text. It may be mostly visual or need JavaScript to render. Try a different URL or enter a project summary manually.",
      metadata: extracted.metadata,
      contentText: extracted.contentText,
    });
  }

  if (fetched.statusCode >= 400) {
    return failure({
      ok: false,
      requestedUrl,
      finalUrl: fetched.finalUrl,
      statusCode: fetched.statusCode,
      reason: "fetch_failed",
      message: `The server returned HTTP ${fetched.statusCode}.`,
      metadata: extracted.metadata,
      contentText: extracted.contentText,
    });
  }

  return {
    ok: true,
    requestedUrl,
    finalUrl: fetched.finalUrl,
    statusCode: fetched.statusCode,
    metadata: extracted.metadata,
    contentText: extracted.contentText,
  };
}
