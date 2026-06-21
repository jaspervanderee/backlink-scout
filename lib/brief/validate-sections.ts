import { BRIEF_SECTION_HEADINGS } from "./prompt";

export function validateBriefSections(brief: string): string[] {
  const warnings: string[] = [];

  for (const heading of BRIEF_SECTION_HEADINGS) {
    if (!brief.includes(heading)) {
      warnings.push(`Missing section heading: ${heading}`);
    }
  }

  return warnings;
}
