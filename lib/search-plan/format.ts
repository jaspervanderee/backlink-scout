import type { SearchPlan } from "./types";

export function formatQueriesAsJson(plan: SearchPlan): string {
  return JSON.stringify(plan.queries, null, 2);
}

export function formatQueriesAsMarkdown(plan: SearchPlan): string {
  const sections = plan.queries.map((query) => {
    const lines = [
      `## ${query.id} (${query.priority})`,
      "",
      `**Query:** ${query.queryText}`,
      `**Hypothesis:** ${query.hypothesisUsed}`,
      `**Expected page type:** ${query.expectedPageType}`,
      `**Rationale:** ${query.rationale}`,
      `**Risk:** ${query.riskNote}`,
      `**Recommended results:** ${query.recommendedResultCount}`,
    ];
    return lines.join("\n");
  });

  return `# Search queries\n\n${sections.join("\n\n")}`;
}
