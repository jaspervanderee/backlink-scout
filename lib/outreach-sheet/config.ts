import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type ServiceAccountKey = {
  clientEmail: string;
  privateKey: string;
  tokenURI: string;
};

export type OutreachSheetConfig = {
  sheetID: string;
  serviceAccount: ServiceAccountKey;
};

const DEFAULT_KEY_PATH = "google-service-account.json";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

export function getOutreachSheetConfig(): OutreachSheetConfig | null {
  const sheetID = process.env.OUTREACH_SHEET_ID?.trim();
  const keyPath = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim() || DEFAULT_KEY_PATH,
  );

  if (!sheetID || !existsSync(keyPath)) {
    return null;
  }

  const key = JSON.parse(readFileSync(keyPath, "utf8")) as Record<string, unknown>;
  if (typeof key.client_email !== "string" || typeof key.private_key !== "string") {
    return null;
  }

  return {
    sheetID,
    serviceAccount: {
      clientEmail: key.client_email,
      privateKey: key.private_key,
      tokenURI: typeof key.token_uri === "string" ? key.token_uri : DEFAULT_TOKEN_URI,
    },
  };
}
