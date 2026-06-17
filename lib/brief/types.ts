export type GenerateBriefResult =
  | { ok: true; brief: string }
  | {
      ok: false;
      reason: "extraction_failed" | "llm_failed" | "config_missing";
      message: string;
    };
