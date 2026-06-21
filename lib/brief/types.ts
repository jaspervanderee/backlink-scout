import { BRIEF_SECTION_HEADINGS } from "./prompt";

export type BriefSectionHeading = (typeof BRIEF_SECTION_HEADINGS)[number];

export type GenerateBriefResult =
  | { ok: true; brief: string; warnings?: string[] }
  | {
      ok: false;
      reason: "extraction_failed" | "llm_failed" | "config_missing";
      message: string;
    };
