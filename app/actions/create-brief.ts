"use server";

import { generateProspectingBrief } from "@/lib/brief/generate-brief";
import type { GenerateBriefResult } from "@/lib/brief/types";
import { fetchAndExtract } from "@/lib/fetch-and-extract";

export async function createProspectingBrief(
  url: string,
): Promise<GenerateBriefResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: "extraction_failed",
      message: "Enter a URL to analyze.",
    };
  }

  const extraction = await fetchAndExtract(trimmed);
  return generateProspectingBrief(extraction);
}
