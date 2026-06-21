"use server";

import { investigateDomain as runInvestigateDomain } from "@/lib/domain-investigation/investigate-domain";
import type { InvestigateDomainResult } from "@/lib/domain-investigation/types";
import type { KeptDomainCandidate } from "@/lib/candidates/types";
import type { SearchQueryResultGroup } from "@/lib/perplexity/types";
import type { SearchPlan } from "@/lib/search-plan/types";

export async function investigateDomain(
  brief: string,
  candidate: KeptDomainCandidate,
  searchPlan: SearchPlan,
  searchResults: SearchQueryResultGroup[],
): Promise<InvestigateDomainResult> {
  return runInvestigateDomain(brief, candidate, searchPlan, searchResults);
}
