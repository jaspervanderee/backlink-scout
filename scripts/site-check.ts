// Usage: npx tsx scripts/site-check.ts <project-id> [domain ...]
// Without domains, checks every labeled domain for that project in evals/labels.tsv.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { checkSite } from "@/lib/site-check/check-site";
import { buildProjectContext } from "@/lib/site-check/project-context";
import type { SiteCheck } from "@/lib/site-check/types";

const CONCURRENCY = 3;

type EvalProject = {
  id: string;
  productUrl: string;
  guideUrl: string | null;
};

function readLabels(projectID: string): Map<string, string> {
  const labels = new Map<string, string>();
  const rows = readFileSync("evals/labels.tsv", "utf8").trim().split("\n").slice(1);

  for (const row of rows) {
    const [project, domain, label] = row.split("\t");
    if (project === projectID) {
      labels.set(domain, label);
    }
  }

  return labels;
}

function formatRow(check: SiteCheck, label: string): string {
  const { evidence, summary } = check;
  const latest = evidence.latestPostAt?.slice(0, 10) ?? "-";
  const route = evidence.routes[0]?.kind ?? (evidence.emails.length > 0 ? "email" : "-");
  const paid = evidence.paidSignals.length > 0 ? "paid?" : "";
  const linking = `${ evidence.postsLinkingOut }/${ evidence.posts.length }`;
  const lean = summary?.lean ?? "error";
  const outside = summary?.featuresOutsideWork ?? "-";

  return [
    check.domain.padEnd(34),
    label.padEnd(12),
    lean.padEnd(7),
    outside.padEnd(8),
    evidence.postSource.padEnd(7),
    latest.padEnd(11),
    linking.padEnd(6),
    `${ route } ${ paid }`.trim(),
  ].join(" ");
}

const SCORE_LABELS = ["featured", "good_target", "long_shot", "not_a_fit", "unlabeled"];
const SCORE_LEANS = ["good", "unsure", "poor", "error"];

function printScore(checks: SiteCheck[], labels: Map<string, string>) {
  const counts = new Map<string, number>();

  for (const check of checks) {
    const label = labels.get(check.domain) ?? "unlabeled";
    const lean = check.summary?.lean ?? "error";
    const key = `${ label }:${ lean }`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const header = ["label \\ lean".padEnd(14), ...SCORE_LEANS.map((lean) => lean.padEnd(8))].join("");
  console.log("\n" + header);

  for (const label of SCORE_LABELS) {
    const cells = SCORE_LEANS.map((lean) => String(counts.get(label + ":" + lean) ?? 0).padEnd(8));
    if (cells.some((cell) => cell.trim() !== "0")) {
      console.log([label.padEnd(14), ...cells].join(""));
    }
  }
}

async function main() {
  process.loadEnvFile(".env.local");

  const [projectID, ...requestedDomains] = process.argv.slice(2);
  const projects = JSON.parse(readFileSync("evals/projects.json", "utf8")) as EvalProject[];
  const project = projects.find((candidate) => candidate.id === projectID);

  if (!project) {
    const knownIDs = projects.map((candidate) => candidate.id).join(", ");
    console.error(`Unknown project. Use one of: ${ knownIDs }`);
    process.exit(1);
  }

  const labels = readLabels(project.id);
  const domains = requestedDomains.length > 0 ? requestedDomains : [...labels.keys()];
  const pageURLs = [project.guideUrl, project.productUrl].filter((url): url is string => Boolean(url));
  const projectContext = await buildProjectContext(pageURLs);

  const checks: SiteCheck[] = new Array(domains.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < domains.length) {
      const index = nextIndex;
      nextIndex += 1;

      const result = await checkSite(domains[index], projectContext);
      if (!result.ok) {
        console.error(`${ domains[index] }: ${ result.message }`);
        continue;
      }

      checks[index] = result.check;
      console.error(`checked ${ result.check.domain } in ${ result.check.durationMs }ms`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const completedChecks = checks.filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  const outputPath = `evals/runs/site-check-${ project.id }-${ today }.json`;
  mkdirSync("evals/runs", { recursive: true });
  writeFileSync(outputPath, JSON.stringify(completedChecks, null, 2));

  console.log(
    ["domain".padEnd(34), "label".padEnd(12), "lean".padEnd(7), "outside".padEnd(8),
      "posts".padEnd(7), "latest".padEnd(11), "links".padEnd(6), "route"].join(" "),
  );
  for (const check of completedChecks) {
    console.log(formatRow(check, labels.get(check.domain) ?? "unlabeled"));
  }

  printScore(completedChecks, labels);
  console.log(`\nSaved ${ outputPath }`);
}

main();
