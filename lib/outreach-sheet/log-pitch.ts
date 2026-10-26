import { getOutreachSheetConfig } from "./config.ts";
import { getAccessToken } from "./google-auth.ts";
import { quoteRange, requestSheets } from "./sheets-client.ts";
import type { LogPitchResult, PitchLogEntry } from "./types.ts";

const SENT_STATUS = "sent";
const MESSAGE_HEADER = "Message";
const NEW_TAB_HEADER = [
  "Name", "website", "email", "Contact", "Date of outreach",
  "Follow up", "Status", "Notes", "Outcome", "Message",
];
// A leading apostrophe makes Sheets store text as typed, so "=…" or "+…" is never run as a formula.
const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

function asLiteralText(value: string): string {
  return FORMULA_PREFIX_PATTERN.test(value) ? `'${ value }` : value;
}

// Matches how Jasper writes dates in the sheet: "19 October".
function formatOutreachDate(isoDate: string): string {
  const date = new Date(`${ isoDate }T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function buildRow(header: string[], entry: PitchLogEntry): string[] {
  const valuesByHeader: Record<string, string> = {
    name: asLiteralText(entry.name),
    website: asLiteralText(entry.website),
    email: asLiteralText(entry.email),
    "date of outreach": formatOutreachDate(entry.date),
    status: SENT_STATUS,
    message: asLiteralText(entry.message),
  };

  return header.map((cell) => valuesByHeader[cell.trim().toLowerCase()] ?? "");
}

async function readHeader(sheetID: string, tabTitle: string, accessToken: string): Promise<string[]> {
  const range = quoteRange(tabTitle, "1:1");
  const result = await requestSheets<{ values?: string[][] }>(`${ sheetID }/values/${ range }`, accessToken);
  return result.values?.[0] ?? [];
}

async function writeHeader(sheetID: string, tabTitle: string, accessToken: string): Promise<void> {
  const range = quoteRange(tabTitle, "A1");
  await requestSheets(`${ sheetID }/values/${ range }?valueInputOption=RAW`, accessToken, {
    method: "PUT",
    body: { values: [NEW_TAB_HEADER] },
  });
}

// Column index 0 is "A", 25 is "Z", 26 is "AA".
function columnLetter(index: number): string {
  let remaining = index + 1;
  let letters = "";

  while (remaining > 0) {
    const offset = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + offset) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return letters;
}

async function addHeaderCell(
  sheetID: string,
  tabTitle: string,
  accessToken: string,
  columnIndex: number,
  title: string,
): Promise<void> {
  const cell = `${ columnLetter(columnIndex) }1`;
  const range = quoteRange(tabTitle, cell);
  await requestSheets(`${ sheetID }/values/${ range }?valueInputOption=RAW`, accessToken, {
    method: "PUT",
    body: { values: [[title]] },
  });
}

export async function logPitch(entry: PitchLogEntry, sheetIDOverride?: string): Promise<LogPitchResult> {
  const config = getOutreachSheetConfig();
  if (!config) {
    return { ok: false, message: "Outreach sheet is not configured." };
  }

  const sheetID = sheetIDOverride ?? config.sheetID;
  const tabTitle = entry.tabTitle.trim();
  if (!tabTitle) {
    return { ok: false, message: "Choose a sheet tab first." };
  }

  try {
    const accessToken = await getAccessToken(config.serviceAccount);
    const spreadsheet = await requestSheets<{ sheets: Array<{ properties: { title: string } }> }>(
      `${ sheetID }?fields=sheets.properties.title`,
      accessToken,
    );
    const tabExists = spreadsheet.sheets.some((sheet) => sheet.properties.title === tabTitle);

    if (!tabExists) {
      await requestSheets(`${ sheetID }:batchUpdate`, accessToken, {
        method: "POST",
        body: { requests: [{ addSheet: { properties: { title: tabTitle } } }] },
      });
    }

    let header = await readHeader(sheetID, tabTitle, accessToken);
    if (header.length === 0) {
      await writeHeader(sheetID, tabTitle, accessToken);
      header = NEW_TAB_HEADER;
    }

    if (!header.some((cell) => cell.trim().toLowerCase() === MESSAGE_HEADER.toLowerCase())) {
      await addHeaderCell(sheetID, tabTitle, accessToken, header.length, MESSAGE_HEADER);
      header = [...header, MESSAGE_HEADER];
    }

    // Write into the first empty row below the data; inserting rows copies formatting (like bold) from above.
    const usedRange = quoteRange(tabTitle, "A:Z");
    const usedRows = await requestSheets<{ values?: string[][] }>(`${ sheetID }/values/${ usedRange }`, accessToken);
    const nextRow = (usedRows.values?.length ?? 0) + 1;
    const range = quoteRange(tabTitle, `A${ nextRow }`);
    await requestSheets(`${ sheetID }/values/${ range }?valueInputOption=USER_ENTERED`, accessToken, {
      method: "PUT",
      body: { values: [buildRow(header, entry)] },
    });

    return { ok: true, tabCreated: !tabExists };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not log the pitch.";
    return { ok: false, message };
  }
}
