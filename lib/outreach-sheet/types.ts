export type ContactedSite = {
  domain: string;
  tab: string;
  name: string;
  outreachDate: string;
  status: string;
  outcome: string;
};

export type OutreachSheetTab = {
  title: string;
  rowCount: number;
};

export type PitchLogEntry = {
  tabTitle: string;
  name: string;
  website: string;
  email: string;
  message: string;
  date: string;
};

export type LogPitchResult =
  | { ok: true; tabCreated: boolean }
  | { ok: false; message: string };

export type ReadOutreachSheetResult =
  | { ok: true; tabs: OutreachSheetTab[]; contactedSites: ContactedSite[] }
  | { ok: false; reason: "config_missing" | "request_failed"; message: string };
