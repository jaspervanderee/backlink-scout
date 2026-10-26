import { parseHTML } from "linkedom";
import { extractReadableContent } from "../fetch-and-extract/extract.ts";
import { fetchStaticPage } from "../fetch-and-extract/fetch-static.ts";
import type { PageLink } from "../fetch-and-extract/types.ts";
import { isSameSite } from "./links.ts";
import { extractHostname } from "../web/hostname.ts";
import type { SiteRoute, SiteRouteKind, SubmissionPage } from "./types.ts";

const ROUTE_FETCH_TIMEOUT_MS = 10_000;
const MAX_ROUTE_PAGES_TO_READ = 2;
const MAX_SUBMISSION_PAGE_CHARS = 8_000;
const MIN_MAIN_TEXT_CHARS = 300;
const PAID_SIGNAL_CONTEXT_CHARS = 60;
const MAX_PAID_SIGNALS = 4;

const ROUTE_PATTERNS: Array<{ kind: SiteRouteKind; pattern: RegExp }> = [
  { kind: "submit", pattern: /submi(t|ssion)|send (us )?your work|get featured|feature (your|my) work/i },
  { kind: "tips", pattern: /send (us )?a tip|submit a tip|news ?tips?\b|tip ?line|tips@|pitch(ing)? (us|guide)|suggest (a|an) (story|link|post)/i },
  { kind: "contact", pattern: /contact|get in touch|write to us/i },
  { kind: "advertise", pattern: /advertis|sponsor|media kit|partner with us/i },
];

const ROUTE_READ_ORDER: SiteRouteKind[] = ["submit", "tips", "contact", "advertise"];

// Article pages often contain route words in their slugs, so only short, non-archive paths count.
const MAX_ROUTE_PATH_LENGTH = 60;
const ARCHIVE_PATH_PATTERN = /\/(tag|tags|category|categories|author|jobs?)\//i;

const PAID_PHRASE_PATTERN =
  /submission fee|paid (?:placement|feature|review|submission)|(?:express|priority) (?:submission|listing|review)|(?:featured|sponsored) (?:submission|listing)|sponsored post/gi;
const CURRENCY_AMOUNT_PATTERN = /[$€£]\s?\d[\d,.]*|\d[\d,.]*\s?(?:usd|eur|gbp)\b/gi;
const PAID_CONTEXT_PATTERN = /submi|feature|listing|placement|review|publish/i;

// Lowercase-only domain endings stop "studio@site.com" + "Get in touch" from merging into "site.com.get".
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}(?![a-z])/g;
const SINGLE_EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function readPath(href: string): string {
  try {
    return new URL(href).pathname;
  } catch {
    return "";
  }
}

function classifyRoute(link: PageLink): SiteRouteKind | null {
  const path = readPath(link.href);
  const pathCounts = path.length <= MAX_ROUTE_PATH_LENGTH && !ARCHIVE_PATH_PATTERN.test(path);

  for (const { kind, pattern } of ROUTE_PATTERNS) {
    if (pattern.test(link.text) || (pathCounts && pattern.test(path.replace(/[-_/]/g, " ")))) {
      return kind;
    }
  }

  return null;
}

export function findRoutes(links: PageLink[], siteDomain: string): {
  routes: SiteRoute[];
  emails: string[];
} {
  const routes: SiteRoute[] = [];
  const emails = new Set<string>();
  const seenUrls = new Set<string>();

  for (const link of links) {
    if (link.href.startsWith("mailto:")) {
      const address = link.href.slice("mailto:".length).split("?")[0].trim();
      if (address) {
        emails.add(address.toLowerCase());
      }
      continue;
    }

    const hostname = extractHostname(link.href);
    if (!hostname || !isSameSite(hostname, siteDomain) || seenUrls.has(link.href)) {
      continue;
    }

    const kind = classifyRoute(link);
    if (!kind) {
      continue;
    }

    seenUrls.add(link.href);
    routes.push({ kind, url: link.href, label: link.text || link.href });
  }

  routes.sort(
    (first, second) => ROUTE_READ_ORDER.indexOf(first.kind) - ROUTE_READ_ORDER.indexOf(second.kind),
  );

  return { routes, emails: [...emails] };
}

function readContext(text: string, match: RegExpMatchArray): string {
  const start = Math.max(0, (match.index ?? 0) - PAID_SIGNAL_CONTEXT_CHARS);
  const end = (match.index ?? 0) + match[0].length + PAID_SIGNAL_CONTEXT_CHARS;
  return text.slice(start, end).trim();
}

function collectPaidSignals(text: string): string[] {
  const phraseSignals = [...text.matchAll(PAID_PHRASE_PATTERN)].map((match) => readContext(text, match));
  const amountSignals = [...text.matchAll(CURRENCY_AMOUNT_PATTERN)]
    .map((match) => readContext(text, match))
    .filter((context) => PAID_CONTEXT_PATTERN.test(context));

  return [...new Set([...phraseSignals, ...amountSignals])].slice(0, MAX_PAID_SIGNALS);
}

function readVisibleText(html: string): string {
  const { document } = parseHTML(html);
  for (const element of document.querySelectorAll("script, style, noscript, template")) {
    element.remove();
  }

  return document.body?.textContent?.replace(/\s+/g, " ") ?? "";
}

// Cloudflare hides addresses as hex: the first byte is a key XOR-ed with every following byte.
function decodeCloudflareEmail(encoded: string): string | null {
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let address = "";

  for (let index = 2; index + 1 < encoded.length; index += 2) {
    const byte = Number.parseInt(encoded.slice(index, index + 2), 16);
    address += String.fromCharCode(byte ^ key);
  }

  return SINGLE_EMAIL_PATTERN.test(address) ? address.toLowerCase() : null;
}

export function findProtectedEmails(html: string): string[] {
  const encodedValues = [
    ...[...html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)].map((match) => match[1]),
    ...[...html.matchAll(/email-protection#([0-9a-f]+)/gi)].map((match) => match[1]),
  ];
  const emails = encodedValues
    .map(decodeCloudflareEmail)
    .filter((address): address is string => Boolean(address));

  return [...new Set(emails)];
}

function revealProtectedEmails(html: string): string {
  return html.replace(
    /<([a-z]+)[^>]*data-cfemail="([0-9a-f]+)"[^>]*>[^<]*<\/\1>/gi,
    (element, _tagName: string, encoded: string) => decodeCloudflareEmail(encoded) ?? element,
  );
}

function readMainText(html: string, pageURL: string): string {
  const mainText = extractReadableContent(html, pageURL)?.contentText ?? "";
  const text = mainText.length >= MIN_MAIN_TEXT_CHARS ? mainText : readVisibleText(html);
  return text.trim().slice(0, MAX_SUBMISSION_PAGE_CHARS);
}

export async function readRoutePages(routes: SiteRoute[]): Promise<{
  emails: string[];
  paidSignals: string[];
  submissionPage: SubmissionPage | null;
}> {
  const emails = new Set<string>();
  const paidSignals: string[] = [];
  let submissionPage: SubmissionPage | null = null;
  const routesToRead = routes
    .filter((route) => route.kind !== "advertise")
    .slice(0, MAX_ROUTE_PAGES_TO_READ);

  for (const route of routesToRead) {
    try {
      const fetched = await fetchStaticPage(route.url, { timeoutMs: ROUTE_FETCH_TIMEOUT_MS });
      if (fetched.statusCode >= 400) {
        continue;
      }

      const html = revealProtectedEmails(fetched.html);
      const text = readVisibleText(html);

      const pageEmails = [
        ...(text.match(EMAIL_PATTERN) ?? []).map((address) => address.toLowerCase()),
        ...findProtectedEmails(fetched.html),
      ];
      for (const address of pageEmails) {
        emails.add(address);
      }

      for (const signal of collectPaidSignals(text)) {
        const labeledSignal = `${ route.kind } page: ${ signal }`;
        paidSignals.push(labeledSignal);
      }

      if (!submissionPage) {
        submissionPage = { url: fetched.finalUrl, kind: route.kind, text: readMainText(html, fetched.finalUrl) };
      }
    } catch {
      continue;
    }
  }

  return { emails: [...emails], paidSignals, submissionPage };
}
