import { extractHostname } from "../web/hostname.ts";
import { getOutreachSheetConfig } from "./config.ts";
import { getAccessToken } from "./google-auth.ts";
import { requestSheets } from "./sheets-client.ts";
import type { ContactedSite, ReadOutreachSheetResult } from "./types.ts";

const MIN_NAME_LENGTH_FOR_MATCH = 5;
const DOMAIN_IN_TEXT_PATTERN = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/i;

type ColumnPositions = {
  name: number;
  website: number;
  outreachDate: number;
  status: number;
  outcome: number;
};

function findColumns(headerRow: string[]): ColumnPositions {
  const headers = headerRow.map((header) => header.trim().toLowerCase());
  const find = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));

  return {
    name: find(/^name$/),
    website: find(/^website$/),
    outreachDate: find(/date of outreach/),
    status: find(/^status$/),
    outcome: find(/^outcome$/),
  };
}

function readCell(row: string[], column: number): string {
  return column >= 0 ? (row[column] ?? "").trim() : "";
}

function findDomain(website: string, name: string): string | null {
  for (const text of [website, name]) {
    const match = text.match(DOMAIN_IN_TEXT_PATTERN);
    const domain = match ? extractHostname(match[1]) : null;
    if (domain) {
      return domain;
    }
  }

  return null;
}

function compactName(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Rows with only a name ("The Awesomer") borrow a domain seen elsewhere in the sheet (theawesomer.com).
function findDomainByName(name: string, knownDomains: string[]): string | null {
  const compact = compactName(name);
  if (compact.length < MIN_NAME_LENGTH_FOR_MATCH) {
    return null;
  }

  return knownDomains.find((domain) => compactName(domain.split(".")[0]) === compact) ?? null;
}

function readTabRows(rows: string[][]): Array<{ row: string[]; columns: ColumnPositions }> {
  const [headerRow = [], ...dataRows] = rows;
  const columns = findColumns(headerRow);
  return dataRows.map((row) => ({ row, columns }));
}

function readContactedSites(tab: string, rows: string[][], knownDomains: string[]): ContactedSite[] {
  const sites: ContactedSite[] = [];

  for (const { row, columns } of readTabRows(rows)) {
    const name = readCell(row, columns.name);
    const domain = findDomain(readCell(row, columns.website), name) ?? findDomainByName(name, knownDomains);
    if (!domain) {
      continue;
    }

    sites.push({
      domain,
      tab,
      name,
      outreachDate: readCell(row, columns.outreachDate),
      status: readCell(row, columns.status),
      outcome: readCell(row, columns.outcome),
    });
  }

  return sites;
}

export async function readOutreachSheet(): Promise<ReadOutreachSheetResult> {
  const config = getOutreachSheetConfig();
  if (!config) {
    return {
      ok: false,
      reason: "config_missing",
      message: "Outreach sheet is not configured. Add OUTREACH_SHEET_ID and google-service-account.json.",
    };
  }

  try {
    const accessToken = await getAccessToken(config.serviceAccount);
    const spreadsheet = await requestSheets<{ sheets: Array<{ properties: { title: string } }> }>(
      `${ config.sheetID }?fields=sheets.properties.title`,
      accessToken,
    );
    const titles = spreadsheet.sheets.map((sheet) => sheet.properties.title);
    const ranges = titles
      .map((title) => {
        const encodedRange = encodeURIComponent(`'${ title }'`);
        return `ranges=${ encodedRange }`;
      })
      .join("&");
    const values = await requestSheets<{ valueRanges: Array<{ values?: string[][] }> }>(
      `${ config.sheetID }/values:batchGet?${ ranges }`,
      accessToken,
    );

    const tabs = titles.map((title, index) => ({
      title,
      rowCount: values.valueRanges[index]?.values?.length ?? 0,
    }));
    const tabRows = titles.map((_title, index) => values.valueRanges[index]?.values ?? []);
    const knownDomains = [...new Set(tabRows.flatMap((rows) =>
      readTabRows(rows)
        .map(({ row, columns }) => findDomain(readCell(row, columns.website), readCell(row, columns.name)))
        .filter((domain): domain is string => Boolean(domain)),
    ))];
    const contactedSites = titles.flatMap((title, index) =>
      readContactedSites(title, tabRows[index], knownDomains),
    );

    return { ok: true, tabs, contactedSites };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the outreach sheet.";
    return { ok: false, reason: "request_failed", message };
  }
}
