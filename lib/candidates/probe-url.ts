import { DEFAULT_USER_AGENT } from "@/lib/fetch-and-extract/constants";

export const REACHABILITY_PROBE_TIMEOUT_MS = 8_000;

export type ProbeReachabilityOutcome =
  | { ok: true; statusCode: number; finalUrl: string }
  | { ok: false; statusCode: number | null; finalUrl: string | null };

function isBlockedStatus(statusCode: number): boolean {
  return (
    statusCode === 401 ||
    statusCode === 402 ||
    statusCode === 403 ||
    statusCode === 429
  );
}

function isDeadStatus(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410 || statusCode === 451;
}

function isReachableStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 400;
}

async function requestProbe(
  url: string,
  method: "HEAD" | "GET",
): Promise<Response> {
  return fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(REACHABILITY_PROBE_TIMEOUT_MS),
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": DEFAULT_USER_AGENT,
    },
  });
}

function classifyResponse(response: Response): ProbeReachabilityOutcome {
  const statusCode = response.status;
  const finalUrl = response.url;

  if (isReachableStatus(statusCode)) {
    return { ok: true, statusCode, finalUrl };
  }

  return { ok: false, statusCode, finalUrl };
}

export async function probeUrlReachability(
  url: string,
): Promise<ProbeReachabilityOutcome> {
  let trimmed: string;
  try {
    trimmed = new URL(url).href;
  } catch {
    return { ok: false, statusCode: null, finalUrl: null };
  }

  try {
    const headResponse = await requestProbe(trimmed, "HEAD");

    if (headResponse.status === 405) {
      await headResponse.body?.cancel();
    } else {
      const headOutcome = classifyResponse(headResponse);
      if (headOutcome.ok) {
        await headResponse.body?.cancel();
        return headOutcome;
      }

      if (
        headOutcome.statusCode !== null &&
        (isBlockedStatus(headOutcome.statusCode) ||
          isDeadStatus(headOutcome.statusCode) ||
          headOutcome.statusCode >= 500)
      ) {
        await headResponse.body?.cancel();
        return headOutcome;
      }

      await headResponse.body?.cancel();
    }
  } catch {
    // Fall through to GET.
  }

  try {
    const getResponse = await requestProbe(trimmed, "GET");
    await getResponse.body?.cancel();
    return classifyResponse(getResponse);
  } catch {
    return { ok: false, statusCode: null, finalUrl: null };
  }
}
