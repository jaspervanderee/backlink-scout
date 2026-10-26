import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_STATIC_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from "./constants.ts";
import type { FetchedPage } from "./types.ts";

export async function fetchStaticPage(
  url: string,
  options: {
    timeoutMs?: number;
    maxResponseBytes?: number;
    userAgent?: string;
  } = {},
): Promise<FetchedPage> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STATIC_TIMEOUT_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": userAgent,
      },
    });

    const finalUrl = response.url || url;
    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      const text = await response.text();
      if (text.length > maxResponseBytes) {
        throw new Error("response_too_large");
      }

      return {
        html: text,
        finalUrl,
        statusCode: response.status,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const html = await response.text();
      return {
        html,
        finalUrl,
        statusCode: response.status,
      };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxResponseBytes) {
        throw new Error("response_too_large");
      }

      chunks.push(value);
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      concatUint8Arrays(chunks),
    );

    return {
      html,
      finalUrl,
      statusCode: response.status,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("timeout");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}
