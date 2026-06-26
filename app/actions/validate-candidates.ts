"use server";

import { validateCandidateReachability } from "@/lib/candidates/validate-reachability";
import type {
  KeptDomainCandidate,
  ValidateReachabilityResult,
} from "@/lib/candidates/types";

export async function validateCandidates(
  candidates: KeptDomainCandidate[],
): Promise<ValidateReachabilityResult> {
  return validateCandidateReachability(candidates);
}
