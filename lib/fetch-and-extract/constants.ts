export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 BacklinkScout/0.1";

export const DEFAULT_STATIC_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MIN_CONTENT_LENGTH = 200;

export const BLOCKED_PAGE_PATTERNS = [
  /attention required!\s*\|\s*cloudflare/i,
  /cf-browser-verification/i,
  /checking your browser before accessing/i,
  /enable javascript and cookies to continue/i,
  /access denied/i,
  /please verify you are a human/i,
  /captcha/i,
  /bot detection/i,
  /unusual traffic/i,
];
