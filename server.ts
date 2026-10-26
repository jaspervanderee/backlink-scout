// Local server for the personal tool: serves tool/ and a few JSON endpoints backed by lib/.
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { chooseSheetTab } from "./lib/outreach-sheet/guess-tab.ts";
import { logPitch } from "./lib/outreach-sheet/log-pitch.ts";
import { readOutreachSheet } from "./lib/outreach-sheet/read-sheet.ts";
import type { PitchLogEntry } from "./lib/outreach-sheet/types.ts";
import { checkSite } from "./lib/site-check/check-site.ts";
import { buildProjectContext } from "./lib/site-check/project-context.ts";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY_BYTES = 1_000_000;
const TOOL_DIRECTORY = path.resolve(import.meta.dirname, "tool");
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

function sendJSON(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJSONBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

async function handleAPI(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === "/api/sheet") {
    const sheet = await readOutreachSheet();
    const printURL = url.searchParams.get("print") ?? "";
    const tabTitles = sheet.ok ? sheet.tabs.map((tab) => tab.title) : [];
    const tabTitle = printURL ? chooseSheetTab(printURL, tabTitles) : "";
    return sendJSON(response, 200, { ...sheet, tabTitle });
  }

  if (request.method !== "POST") {
    return sendJSON(response, 405, { ok: false, message: "Method not allowed." });
  }

  const body = await readJSONBody(request);

  if (url.pathname === "/api/project-context") {
    const urls = Array.isArray(body.urls) ? body.urls.filter((item) => typeof item === "string" && item.trim()) : [];
    return sendJSON(response, 200, { context: await buildProjectContext(urls) });
  }

  if (url.pathname === "/api/check-site") {
    return sendJSON(response, 200, await checkSite(readString(body, "domain"), readString(body, "projectContext")));
  }

  if (url.pathname === "/api/log-pitch") {
    const entry: PitchLogEntry = {
      tabTitle: readString(body, "tabTitle"),
      name: readString(body, "name"),
      website: readString(body, "website"),
      email: readString(body, "email"),
      message: readString(body, "message"),
      date: readString(body, "date"),
    };
    if (!entry.website) {
      return sendJSON(response, 400, { ok: false, message: "The pitch has no website to log." });
    }
    return sendJSON(response, 200, await logPitch(entry));
  }

  return sendJSON(response, 404, { ok: false, message: "Unknown endpoint." });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${ HOST }`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleAPI(request, response, url);
      return;
    }

    const staticFile = STATIC_FILES[url.pathname];
    if (!staticFile) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": staticFile.type });
    response.end(readFileSync(path.join(TOOL_DIRECTORY, staticFile.file)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    sendJSON(response, 500, { ok: false, message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Backlink Scout running at http://localhost:${ PORT }`);
});
