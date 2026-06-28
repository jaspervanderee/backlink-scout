"use server";

import { runCandidatePrescan } from "@/lib/candidates/prescan";
import type { CandidatePrescanResult } from "@/lib/candidates/prescan";
import type { KeptDomainCandidate } from "@/lib/candidates/types";
import type { SearchPlan } from "@/lib/search-plan/types";

export async function prescanCandidates(
  candidates: KeptDomainCandidate[],
  searchPlan: SearchPlan,
): Promise<CandidatePrescanResult> {
  return runCandidatePrescan(candidates, searchPlan);
}
