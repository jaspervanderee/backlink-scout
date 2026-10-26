export type FetchFailureReason =
  | "invalid_url"
  | "fetch_failed"
  | "timeout"
  | "response_too_large"
  | "blocked"
  | "too_thin"
  | "parse_failed";

export type PageLink = {
  href: string;
  text: string;
};

export type PageMetadata = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  openGraph: Record<string, string>;
  links: PageLink[];
};

export type FetchAndExtractSuccess = {
  ok: true;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  metadata: PageMetadata;
  contentText: string;
};

export type FetchAndExtractFailure = {
  ok: false;
  requestedUrl: string;
  finalUrl: string | null;
  statusCode: number | null;
  reason: FetchFailureReason;
  message: string;
  metadata: PageMetadata | null;
  contentText: string | null;
};

export type FetchAndExtractResult =
  | FetchAndExtractSuccess
  | FetchAndExtractFailure;

export type FetchAndExtractOptions = {
  /** Static fetch timeout in milliseconds. Default: 15_000 */
  staticTimeoutMs?: number;
  /** Max response body size in bytes. Default: 5_242_880 (5 MB) */
  maxResponseBytes?: number;
  /** Minimum extracted text length before treating content as too thin. Default: 200 */
  minContentLength?: number;
  /** Custom user agent for HTTP requests. */
  userAgent?: string;
};

export type FetchedPage = {
  html: string;
  finalUrl: string;
  statusCode: number;
};
