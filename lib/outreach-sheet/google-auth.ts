import { createSign } from "node:crypto";
import type { ServiceAccountKey } from "./config.ts";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_LIFETIME_SECONDS = 3_600;
// Renew a little early so a request never starts with a token about to expire.
const TOKEN_RENEWAL_MARGIN_MS = 60_000;

let cachedToken: { value: string; expiresAt: number } | null = null;

function encodeBase64URL(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function buildSignedAssertion(serviceAccount: ServiceAccountKey, issuedAt: number): string {
  const header = encodeBase64URL(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = encodeBase64URL(JSON.stringify({
    iss: serviceAccount.clientEmail,
    scope: SHEETS_SCOPE,
    aud: serviceAccount.tokenURI,
    iat: issuedAt,
    exp: issuedAt + TOKEN_LIFETIME_SECONDS,
  }));
  const unsigned = `${ header }.${ claims }`;
  const signature = encodeBase64URL(
    createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.privateKey),
  );

  return `${ unsigned }.${ signature }`;
}

export async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_RENEWAL_MARGIN_MS) {
    return cachedToken.value;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const response = await fetch(serviceAccount.tokenURI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildSignedAssertion(serviceAccount, issuedAt),
    }),
  });

  const payload = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? `Google sign-in failed with status ${ response.status }`);
  }

  const lifetimeMs = (payload.expires_in ?? TOKEN_LIFETIME_SECONDS) * 1000;
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + lifetimeMs };
  return payload.access_token;
}
