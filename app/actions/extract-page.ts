"use server";

import { fetchAndExtract } from "@/lib/fetch-and-extract";
import type { FetchAndExtractResult } from "@/lib/fetch-and-extract";

export async function extractPage(url: string): Promise<FetchAndExtractResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return {
      ok: false,
      requestedUrl: url,
      finalUrl: null,
      statusCode: null,
      reason: "invalid_url",
      message: "Enter a URL to extract.",
      metadata: null,
      contentMarkdown: null,
      contentText: null,
    };
  }

  return fetchAndExtract(trimmed);
}
