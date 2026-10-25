const SHEETS_API_URL = "https://sheets.googleapis.com/v4/spreadsheets";

export async function requestSheets<T>(
  path: string,
  accessToken: string,
  init: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${ SHEETS_API_URL }/${ path }`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${ accessToken }`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const payload = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Google Sheets request failed with status ${ response.status }`);
  }

  return payload;
}

export function quoteRange(tabTitle: string, cells: string): string {
  const escapedTitle = tabTitle.replace(/'/g, "''");
  return encodeURIComponent(`'${ escapedTitle }'!${ cells }`);
}
