"use server";

import { generateSearchPlan as generateSearchPlanLib } from "@/lib/search-plan/generate-search-plan";
import type { GenerateSearchPlanResult } from "@/lib/search-plan/types";

export async function generateSearchPlan(
  brief: string,
  projectUrl: string,
): Promise<GenerateSearchPlanResult> {
  return generateSearchPlanLib(brief, projectUrl);
}
