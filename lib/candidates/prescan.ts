import type { KeptDomainCandidate } from "./types";
import type { SearchPlan } from "@/lib/search-plan/types";
import {
  PRESCAN_LINK_PROBE_CONCURRENCY,
  probeOutsideLinks,
} from "./prescan-link-probe";

export type PrescanDecision = "investigate" | "maybe" | "skip";

export type PrescanSkipCategory =
  | "own_catalog_or_ecommerce"
  | "marketplace"
  | "template_or_tool"
  | "award_or_paid_submission"
  | "official_or_licensing_risk"
  | "directory_no_editorial"
  | "document_host"
  | "announcement"
  | "press_about_self"
  | "unrelated_accidental_overlap";

export type PrescanMaybeCategory = "self_promotional_content_marketing";

export type CandidatePrescanEntry = {
  candidate: KeptDomainCandidate;
  decision: PrescanDecision;
  reason: string;
  skipCategory: PrescanSkipCategory | null;
  maybeCategory: PrescanMaybeCategory | null;
};

export type CandidatePrescanStats = {
  inputCount: number;
  investigateCount: number;
  maybeCount: number;
  skipCount: number;
  linkProbeCount: number;
  linkProbeDemotions: number;
};

export type CandidatePrescanResult = {
  ok: true;
  stats: CandidatePrescanStats;
  entries: CandidatePrescanEntry[];
  investigationCandidates: KeptDomainCandidate[];
};

const STRONG_SHOPPING_TOKENS = [
  "buy",
  "for sale",
  "add to cart",
  "order now",
  "checkout",
  "discount",
  "price",
];

const STRONG_PUBLISHER_TEXT_SIGNALS = [
  "magazine",
  "newsletter",
  "publication",
  "journal",
  "editorial",
  "feature",
  "roundup",
  "gift guide",
  "curated list",
  "interview",
  "case study",
];

const CONDITIONAL_EDITORIAL_TEXT_SIGNALS = [
  "resources",
  "resource list",
  "tools list",
  "review",
  "guide",
  "examples",
  "blog",
  "article",
  "insight",
  "ideas",
];

const STRONG_PUBLISHER_PATH_SEGMENTS = [
  "/design/",
  "/news/",
  "/articles/",
  "/features/",
  "/magazine/",
];

const CONDITIONAL_EDITORIAL_PATH_SEGMENTS = [
  "/blog/",
  "/guide/",
  "/ideas/",
  "/insight/",
  "/blogs/news",
];

const WEAK_EDITORIAL_SIGNALS = ["inspiration", "showcase"];

const OUTSIDE_SUBJECT_TEXT_SIGNALS = [
  "independent project",
  "indie project",
  "creator",
  "their project",
  "his project",
  "her project",
  "third-party",
  "third party",
  "external product",
  "outside product",
  "artist spotlight",
  "designer spotlight",
  "created by",
  "designed by",
  "work of",
  "portfolio of",
];

const SELF_PROMOTIONAL_ROUNDUP_SIGNALS = [
  "roundup",
  "gift guide",
  "best of",
  "top 10",
  "top ten",
  "our favorites",
  "our favourite",
  "we love",
  "shop our",
];

const MARKETPLACE_DOMAINS = [
  "99designs.com",
  "fiverr.com",
  "upwork.com",
  "crowdspring.com",
  "designcrowd.com",
  "peopleperhour.com",
];

const OFFICIAL_BODY_DOMAINS = [
  "fifa.com",
  "uefa.com",
  "nfl.com",
  "mlb.com",
  "nba.com",
];

const SCHOOL_CUES = [
  "university",
  "college",
  "campus",
  "school",
  "department",
  "faculty",
  "syllabus",
  "course",
  "student",
  "academic",
  "library",
];

const CORPORATE_ANNOUNCEMENT_CUES = [
  "announces",
  "press release",
  "company news",
  "hiring",
  "careers",
  "job opening",
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "our",
  "are",
  "was",
  "has",
  "have",
  "about",
]);

const MIN_SHARED_TOPIC_TOKENS = 2;
const MIN_TOPIC_OVERLAP_RATIO = 0.15;

type SkipMatch = {
  skipCategory: PrescanSkipCategory;
  reason: string;
};

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  return new Set(tokens);
}

function buildTopicTokens(searchPlan: SearchPlan): Set<string> {
  const parts = [
    searchPlan.metadata.projectCategory,
    ...searchPlan.metadata.targetAudiences,
  ];

  return tokenize(parts.join(" "));
}

function buildCandidateEvidenceText(candidate: KeptDomainCandidate): string {
  const parts = [
    candidate.representativeTitle,
    getUrlPath(candidate.representativeUrl),
  ];

  for (const hit of candidate.sourceHits) {
    parts.push(hit.title, hit.snippet, getUrlPath(hit.url));
  }

  return parts.join(" ");
}

function getUrlPath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function combinedCandidateText(
  candidate: KeptDomainCandidate,
  evidenceText: string,
): string {
  const path = getUrlPath(candidate.representativeUrl);
  return `${ candidate.domain } ${ path } ${ evidenceText }`.toLowerCase();
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${ domain }`);
}

function tokenVariants(token: string): string[] {
  const variants = [token];

  if (token.endsWith("s") && token.length > 4) {
    variants.push(token.slice(0, -1));
  } else if (!token.endsWith("s")) {
    variants.push(`${ token }s`);
  }

  return variants;
}

function evidenceTokensMatchTopic(
  topicTokens: Set<string>,
  evidenceToken: string,
): boolean {
  for (const topicToken of topicTokens) {
    if (topicToken === evidenceToken) {
      return true;
    }

    const topicVariants = tokenVariants(topicToken);
    const evidenceVariants = tokenVariants(evidenceToken);

    for (const topicVariant of topicVariants) {
      for (const evidenceVariant of evidenceVariants) {
        if (topicVariant === evidenceVariant) {
          return true;
        }
      }
    }
  }

  return false;
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function hasStrongPublisherPath(path: string): boolean {
  return containsAny(path, STRONG_PUBLISHER_PATH_SEGMENTS);
}

function hasConditionalEditorialPath(path: string): boolean {
  return containsAny(path, CONDITIONAL_EDITORIAL_PATH_SEGMENTS);
}

function hasStrongPublisherTextSignal(text: string): boolean {
  return containsAny(text, STRONG_PUBLISHER_TEXT_SIGNALS);
}

function hasConditionalEditorialTextSignal(text: string): boolean {
  return containsAny(text, CONDITIONAL_EDITORIAL_TEXT_SIGNALS);
}

function hasCredibleIndependentPublisherSignal(
  text: string,
  path: string,
): boolean {
  return hasStrongPublisherTextSignal(text) || hasStrongPublisherPath(path);
}

function hasConditionalEditorialSurface(text: string, path: string): boolean {
  return (
    hasConditionalEditorialTextSignal(text) ||
    hasConditionalEditorialPath(path)
  );
}

function hasAnyEditorialSurface(text: string, path: string): boolean {
  return (
    hasCredibleIndependentPublisherSignal(text, path) ||
    hasConditionalEditorialSurface(text, path) ||
    containsAny(text, WEAK_EDITORIAL_SIGNALS)
  );
}

function countExternalUrlsInEvidence(evidenceText: string, siteDomain: string): number {
  const urlPattern = /https?:\/\/[^\s)]+/gi;
  const matches = evidenceText.match(urlPattern) ?? [];
  let externalCount = 0;

  for (const match of matches) {
    try {
      const hostname = new URL(match).hostname.toLowerCase();
      if (!hostnameMatchesDomain(hostname, siteDomain.toLowerCase())) {
        externalCount += 1;
      }
    } catch {
      continue;
    }
  }

  return externalCount;
}

function hasOutsideSubjectEvidence(
  evidenceText: string,
  siteDomain: string,
): boolean {
  const lowerEvidence = evidenceText.toLowerCase();

  if (containsAny(lowerEvidence, OUTSIDE_SUBJECT_TEXT_SIGNALS)) {
    return true;
  }

  return countExternalUrlsInEvidence(evidenceText, siteDomain) > 0;
}

function isLikelySelfPromotionalRoundup(text: string, path: string): boolean {
  if (!containsAny(text, SELF_PROMOTIONAL_ROUNDUP_SIGNALS)) {
    return false;
  }

  const selfOwnedLanguage = containsAny(text, [
    "our favorites",
    "our favourite",
    "our favorite",
    "we love",
    "shop our",
  ]);
  const conditionalOnly =
    hasConditionalEditorialPath(path) && !hasStrongPublisherPath(path);

  return conditionalOnly || selfOwnedLanguage;
}

function countTopicOverlap(
  topicTokens: Set<string>,
  evidenceText: string,
): { sharedCount: number; ratio: number } {
  if (topicTokens.size === 0) {
    return { sharedCount: 0, ratio: 0 };
  }

  const evidenceTokens = tokenize(evidenceText);
  let sharedCount = 0;

  for (const evidenceToken of evidenceTokens) {
    if (evidenceTokensMatchTopic(topicTokens, evidenceToken)) {
      sharedCount += 1;
    }
  }

  const ratio = sharedCount / topicTokens.size;
  return { sharedCount, ratio };
}

function hasTopicOverlap(
  topicTokens: Set<string>,
  evidenceText: string,
): boolean {
  const { sharedCount, ratio } = countTopicOverlap(topicTokens, evidenceText);

  if (sharedCount >= MIN_SHARED_TOPIC_TOKENS) {
    return true;
  }

  return sharedCount >= 1 && ratio >= MIN_TOPIC_OVERLAP_RATIO;
}

function matchDocumentHost(
  path: string,
  url: string,
  evidenceText: string,
): SkipMatch | null {
  const lowerUrl = url.toLowerCase();

  if (/\.(pdf|ppt|pptx|doc|docx)(\?|$)/i.test(lowerUrl)) {
    return {
      skipCategory: "document_host",
      reason: "URL points to a document file, not an editorial page.",
    };
  }

  if (/\[pdf\]/i.test(evidenceText)) {
    return {
      skipCategory: "document_host",
      reason: "Search result title marks a PDF document, not an editorial page.",
    };
  }

  const documentPathTokens = [
    "/pdf/",
    "/slides/",
    "/download/",
    "/documents/",
    "/bitstream/",
    "bitstream",
    "server/api/core",
    "/repository/",
    "/handle/",
    "dspace",
    "eprints",
    "arxiv.org",
    "slideshare",
  ];

  if (containsAny(path, documentPathTokens) || containsAny(lowerUrl, documentPathTokens)) {
    return {
      skipCategory: "document_host",
      reason: "URL looks like a document, repository, or slide host.",
    };
  }

  return null;
}

function matchMarketplace(
  hostname: string,
  text: string,
): SkipMatch | null {
  for (const domain of MARKETPLACE_DOMAINS) {
    if (hostnameMatchesDomain(hostname, domain)) {
      return {
        skipCategory: "marketplace",
        reason: "Freelance or design contest marketplace, not an editorial publisher.",
      };
    }
  }

  const marketplaceTokens = [
    "marketplace",
    "hire a designer",
    "freelance contest",
    "design contest",
    "crowdsource",
    "print on demand",
  ];

  if (containsAny(text, marketplaceTokens)) {
    return {
      skipCategory: "marketplace",
      reason: "Page looks like a marketplace or contest platform.",
    };
  }

  return null;
}

function countStrongShoppingSignals(text: string): number {
  let count = 0;

  for (const token of STRONG_SHOPPING_TOKENS) {
    if (text.includes(token)) {
      count += 1;
    }
  }

  return count;
}

function matchEcommerce(text: string, path: string): SkipMatch | null {
  const shopPaths = [
    "/shop",
    "/store",
    "/product",
    "/products",
    "/cart",
    "/checkout",
    "/collections",
  ];

  const hasShopPath = containsAny(path, shopPaths);
  const strongShoppingCount = countStrongShoppingSignals(text);
  const hasSnippetShopOnly =
    text.includes("shop") && !hasShopPath && strongShoppingCount === 0;

  if (hasSnippetShopOnly) {
    return null;
  }

  if (hasShopPath) {
    return {
      skipCategory: "own_catalog_or_ecommerce",
      reason: "URL path looks like a shop or product catalog.",
    };
  }

  if (strongShoppingCount >= 2) {
    return {
      skipCategory: "own_catalog_or_ecommerce",
      reason: "Search result shows multiple strong ecommerce cues.",
    };
  }

  if (text.includes("shop") && strongShoppingCount >= 1) {
    return {
      skipCategory: "own_catalog_or_ecommerce",
      reason: "Search result combines shop language with other ecommerce cues.",
    };
  }

  return null;
}

function matchTemplateOrTool(text: string, path: string): SkipMatch | null {
  const toolPaths = ["/template", "/generator", "/create/", "/maker"];
  const toolTokens = [
    "template download",
    "mockup generator",
    "design tool",
    "free template",
    "logo maker",
    "poster maker",
  ];

  if (containsAny(path, toolPaths) || containsAny(text, toolTokens)) {
    return {
      skipCategory: "template_or_tool",
      reason: "Page looks like a template or generator tool.",
    };
  }

  return null;
}

function matchAwardOrPaidSubmission(text: string): SkipMatch | null {
  const tokens = [
    "design award",
    "call for entries",
    "submission fee",
    "paid feature",
    "contest winner",
    "enter the competition",
    "award winners",
  ];

  if (containsAny(text, tokens)) {
    return {
      skipCategory: "award_or_paid_submission",
      reason: "Page looks like an award or paid submission route.",
    };
  }

  return null;
}

function matchOfficialOrLicensing(
  hostname: string,
  text: string,
): SkipMatch | null {
  if (hostname.endsWith(".gov")) {
    return {
      skipCategory: "official_or_licensing_risk",
      reason: "Government site is unlikely to publish third-party editorial features.",
    };
  }

  for (const domain of OFFICIAL_BODY_DOMAINS) {
    if (hostnameMatchesDomain(hostname, domain)) {
      return {
        skipCategory: "official_or_licensing_risk",
        reason: "Official sports body site with licensing risk for outreach.",
      };
    }
  }

  const licensingTokens = [
    "official merchandise",
    "licensed product",
    "official store",
  ];

  if (containsAny(text, licensingTokens)) {
    return {
      skipCategory: "official_or_licensing_risk",
      reason: "Page emphasizes official or licensed products.",
    };
  }

  if (hostname.endsWith(".edu") && containsAny(text, SCHOOL_CUES)) {
    return {
      skipCategory: "official_or_licensing_risk",
      reason: "School or academic page, not a third-party editorial outlet.",
    };
  }

  return null;
}

function matchDirectoryNoEditorial(text: string, path: string): SkipMatch | null {
  const directoryTokens = [
    "business directory",
    "company listing",
    "database of",
    "list of companies",
  ];

  if (
    containsAny(text, directoryTokens) &&
    !hasAnyEditorialSurface(text, path)
  ) {
    return {
      skipCategory: "directory_no_editorial",
      reason: "Directory or listing page without an editorial feature angle.",
    };
  }

  return null;
}

function matchAnnouncement(text: string, path: string): SkipMatch | null {
  const corporatePaths = ["/about", "/company", "/corporate"];

  if (
    containsAny(text, CORPORATE_ANNOUNCEMENT_CUES) &&
    (containsAny(path, corporatePaths) || containsAny(text, ["/careers"]))
  ) {
    return {
      skipCategory: "announcement",
      reason: "Corporate announcement or careers page, not external editorial coverage.",
    };
  }

  return null;
}

function matchPressAboutSelf(text: string, path: string): SkipMatch | null {
  const pressPaths = ["/press", "/newsroom", "/media-room", "/about-us"];

  if (
    containsAny(path, pressPaths) &&
    !hasCredibleIndependentPublisherSignal(text, path)
  ) {
    return {
      skipCategory: "press_about_self",
      reason: "Press or about page about the site itself, not third-party features.",
    };
  }

  return null;
}

function matchUnrelatedOverlap(
  topicTokens: Set<string>,
  evidenceText: string,
  text: string,
  path: string,
): SkipMatch | null {
  if (hasAnyEditorialSurface(text, path)) {
    return null;
  }

  if (hasTopicOverlap(topicTokens, evidenceText)) {
    return null;
  }

  return {
    skipCategory: "unrelated_accidental_overlap",
    reason:
      "Search result title, snippet, and URL show no topic overlap with the project and no editorial outreach surface.",
  };
}

function findSkipMatch(
  candidate: KeptDomainCandidate,
  topicTokens: Set<string>,
  evidenceText: string,
  text: string,
  path: string,
  hostname: string,
): SkipMatch | null {
  const checks = [
    () => matchDocumentHost(path, candidate.representativeUrl, evidenceText),
    () => matchMarketplace(hostname, text),
    () => matchEcommerce(text, path),
    () => matchTemplateOrTool(text, path),
    () => matchAwardOrPaidSubmission(text),
    () => matchOfficialOrLicensing(hostname, text),
    () => matchDirectoryNoEditorial(text, path),
    () => matchAnnouncement(text, path),
    () => matchPressAboutSelf(text, path),
    () => matchUnrelatedOverlap(topicTokens, evidenceText, text, path),
  ];

  for (const check of checks) {
    const match = check();
    if (match) {
      return match;
    }
  }

  return null;
}

function buildMaybeEntry(
  candidate: KeptDomainCandidate,
  reason: string,
  maybeCategory: PrescanMaybeCategory | null = null,
): CandidatePrescanEntry {
  return {
    candidate,
    decision: "maybe",
    reason,
    skipCategory: null,
    maybeCategory,
  };
}

export function evaluatePrescan(
  candidate: KeptDomainCandidate,
  searchPlan: SearchPlan,
): CandidatePrescanEntry {
  const topicTokens = buildTopicTokens(searchPlan);
  const evidenceText = buildCandidateEvidenceText(candidate);
  const path = getUrlPath(candidate.representativeUrl);
  const text = combinedCandidateText(candidate, evidenceText);
  const hostname = candidate.domain.toLowerCase();

  const skipMatch = findSkipMatch(
    candidate,
    topicTokens,
    evidenceText,
    text,
    path,
    hostname,
  );

  if (skipMatch) {
    return {
      candidate,
      decision: "skip",
      reason: skipMatch.reason,
      skipCategory: skipMatch.skipCategory,
      maybeCategory: null,
    };
  }

  const overlap = hasTopicOverlap(topicTokens, evidenceText);
  const publisherSignal = hasCredibleIndependentPublisherSignal(text, path);
  const outsideSubjectEvidence = hasOutsideSubjectEvidence(evidenceText, hostname);

  if (!overlap) {
    if (hasAnyEditorialSurface(text, path)) {
      return buildMaybeEntry(
        candidate,
        "Editorial surface signal present, but search result lacks clear project topic overlap.",
      );
    }

    return buildMaybeEntry(
      candidate,
      "No confident skip or investigate signal from search result text.",
    );
  }

  if (outsideSubjectEvidence) {
    return {
      candidate,
      decision: "investigate",
      reason:
        "Search result shows topic overlap and evidence of outside products, projects, or creators.",
      skipCategory: null,
      maybeCategory: null,
    };
  }

  if (isLikelySelfPromotionalRoundup(text, path)) {
    return buildMaybeEntry(
      candidate,
      "Likely own-brand roundup or content marketing without outside-subject evidence.",
      "self_promotional_content_marketing",
    );
  }

  if (publisherSignal) {
    return {
      candidate,
      decision: "investigate",
      reason:
        "Search result shows topic overlap and a credible independent editorial publisher signal.",
      skipCategory: null,
      maybeCategory: null,
    };
  }

  if (hasConditionalEditorialSurface(text, path)) {
    return buildMaybeEntry(
      candidate,
      "Topic overlap with only a blog, guide, or ideas-style surface — not enough for pre-scan investigate.",
    );
  }

  return buildMaybeEntry(
    candidate,
    "Topic overlap present, but no credible independent publisher or outside-subject evidence.",
  );
}

export function demoteEntryForSelfPromotionalLinks(
  entry: CandidatePrescanEntry,
  externalLinkCount: number,
  internalLinkCount: number,
): CandidatePrescanEntry {
  if (entry.decision !== "investigate") {
    return entry;
  }

  return buildMaybeEntry(
    entry.candidate,
    `Page link probe found ${ internalLinkCount } internal and ${ externalLinkCount } external substantive links; featured links appear self-contained.`,
    "self_promotional_content_marketing",
  );
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );

  return results;
}

export async function runCandidatePrescan(
  candidates: KeptDomainCandidate[],
  searchPlan: SearchPlan,
): Promise<CandidatePrescanResult> {
  const entries = candidates.map((candidate) =>
    evaluatePrescan(candidate, searchPlan),
  );

  const investigateIndexes = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.decision === "investigate");

  let linkProbeDemotions = 0;

  if (investigateIndexes.length > 0) {
    const probedEntries = await mapWithConcurrency(
      investigateIndexes,
      PRESCAN_LINK_PROBE_CONCURRENCY,
      async ({ entry, index }) => {
        const probe = await probeOutsideLinks(
          entry.candidate.representativeUrl,
          entry.candidate.domain,
        );

        if (!probe.ok || !probe.featuredLinksAllInternal) {
          return { index, entry };
        }

        linkProbeDemotions += 1;
        return {
          index,
          entry: demoteEntryForSelfPromotionalLinks(
            entry,
            probe.externalLinkCount,
            probe.internalLinkCount,
          ),
        };
      },
    );

    for (const probed of probedEntries) {
      entries[probed.index] = probed.entry;
    }
  }

  let investigateCount = 0;
  let maybeCount = 0;
  let skipCount = 0;

  for (const entry of entries) {
    if (entry.decision === "investigate") {
      investigateCount += 1;
      continue;
    }

    if (entry.decision === "maybe") {
      maybeCount += 1;
      continue;
    }

    skipCount += 1;
  }

  const investigationCandidates = entries
    .filter((entry) => entry.decision === "investigate")
    .map((entry) => entry.candidate);

  const stats: CandidatePrescanStats = {
    inputCount: candidates.length,
    investigateCount,
    maybeCount,
    skipCount,
    linkProbeCount: investigateIndexes.length,
    linkProbeDemotions,
  };

  console.log(
    `[prescan] ${ stats.inputCount } in → ${ investigateCount } investigate, ${ maybeCount } maybe, ${ skipCount } skip (${ stats.linkProbeCount } link probes, ${ linkProbeDemotions } demotions)`,
  );

  return {
    ok: true,
    stats,
    entries,
    investigationCandidates,
  };
}

export function formatSkipCategory(category: PrescanSkipCategory): string {
  switch (category) {
    case "own_catalog_or_ecommerce":
      return "Shop or catalog";
    case "marketplace":
      return "Marketplace";
    case "template_or_tool":
      return "Template or tool";
    case "award_or_paid_submission":
      return "Award or paid submission";
    case "official_or_licensing_risk":
      return "Official or licensing risk";
    case "directory_no_editorial":
      return "Directory without editorial angle";
    case "document_host":
      return "Document host";
    case "announcement":
      return "Announcement";
    case "press_about_self":
      return "Press about self";
    case "unrelated_accidental_overlap":
      return "Unrelated overlap";
  }
}

export function formatMaybeCategory(category: PrescanMaybeCategory): string {
  switch (category) {
    case "self_promotional_content_marketing":
      return "Self-promotional content marketing";
  }
}
