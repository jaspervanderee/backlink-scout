"use server";

import { logPitch } from "@/lib/outreach-sheet/log-pitch";
import { readOutreachSheet } from "@/lib/outreach-sheet/read-sheet";
import type { LogPitchResult, PitchLogEntry, ReadOutreachSheetResult } from "@/lib/outreach-sheet/types";

export async function readContactedSites(): Promise<ReadOutreachSheetResult> {
  return readOutreachSheet();
}

export async function logSentPitch(entry: PitchLogEntry): Promise<LogPitchResult> {
  if (!entry.website.trim()) {
    return { ok: false, message: "The pitch has no website to log." };
  }

  return logPitch(entry);
}
