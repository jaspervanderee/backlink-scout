// Usage: node scripts/outreach-sheet.ts
// Read-only check of the outreach sheet: tabs, row counts and contacted domains.
import { readOutreachSheet } from "../lib/outreach-sheet/read-sheet.ts";

async function main() {
  process.loadEnvFile(".env.local");

  const result = await readOutreachSheet();
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }

  for (const tab of result.tabs) {
    const tabSites = result.contactedSites.filter((site) => site.tab === tab.title);
    console.log(`${ tab.title }: ${ tab.rowCount } rows, ${ tabSites.length } sites`);
  }

  const uniqueDomains = new Set(result.contactedSites.map((site) => site.domain));
  console.log(`\n${ uniqueDomains.size } unique domains contacted:`);
  console.log([...uniqueDomains].sort().join(", "));
}

main();
