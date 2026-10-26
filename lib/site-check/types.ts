import type { PitchDraft } from "../pitch-draft/types.ts";

export type SitePost = {
  title: string;
  url: string;
  publishedAt: string | null;
  excerpt: string;
  outboundDomains: string[];
};

export type PostSource = "feed" | "search" | "none";

export type SiteSearchResult = {
  ok: boolean;
  searchQuery: string;
  evidence: Array<{
    url: string;
    title: string;
    snippet: string;
    date: string | null;
    lastUpdated: string | null;
  }>;
  error: string | null;
};

export type SiteRouteKind = "submit" | "tips" | "contact" | "advertise";

export type SiteRoute = {
  kind: SiteRouteKind;
  url: string;
  label: string;
};

export type SubmissionPage = {
  url: string;
  kind: SiteRouteKind;
  text: string;
};

export type SiteEvidence = {
  domain: string;
  homepageUrl: string;
  homepageReachable: boolean;
  homepageBlocked: boolean;
  homepageTitle: string | null;
  homepageDescription: string | null;
  postSource: PostSource;
  feedUrl: string | null;
  posts: SitePost[];
  similarPosts: SitePost[];
  latestPostAt: string | null;
  postsLast90Days: number;
  postsLinkingOut: number;
  routes: SiteRoute[];
  emails: string[];
  paidSignals: string[];
  submissionPage: SubmissionPage | null;
  aboutURL: string | null;
  notes: string[];
};

export type OutsideWorkAnswer = "yes" | "rarely" | "no" | "unclear";

export type SiteLean = "good" | "unsure" | "poor";

export type ClosestPrecedent = {
  title: string;
  url: string;
  why: string;
};

export type SubmissionRequirements = {
  method: string;
  materials: string[];
  information: string[];
  rules: string[];
  paidOnly: boolean;
};

export type SiteCheckSummary = {
  topics: string;
  contentFormat: string;
  featuresOutsideWork: OutsideWorkAnswer;
  featuresOutsideWorkNote: string;
  closestPrecedent: ClosestPrecedent | null;
  fitNote: string;
  angle: string;
  submission: SubmissionRequirements;
  lean: SiteLean;
  leanReason: string;
};

export type SiteCheck = {
  domain: string;
  evidence: SiteEvidence;
  summary: SiteCheckSummary | null;
  draft: PitchDraft | null;
  error: string | null;
  durationMs: number;
};

export type SiteCheckResult =
  | { ok: true; check: SiteCheck }
  | { ok: false; reason: "invalid_domain" | "config_missing"; message: string };
