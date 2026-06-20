"use server";

import { executeSearchPlan as executeSearchPlanLib } from "@/lib/perplexity/execute-search-plan";
import type { ExecuteSearchPlanResult } from "@/lib/perplexity/types";
import type { SearchPlan } from "@/lib/search-plan/types";

export async function executeSearchPlan(
  plan: SearchPlan,
): Promise<ExecuteSearchPlanResult> {
  return executeSearchPlanLib(plan);
}
