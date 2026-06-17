import type { FetchAndExtractResult } from "@/lib/fetch-and-extract";

const MAX_CONTENT_CHARS = 12_000;

export const BRIEF_SYSTEM_PROMPT = `You write prospecting briefs for backlink and mention discovery.

Your job is to understand a project from extracted website content and write a structured plain-text brief that another system can later use to find legitimate editorial outreach opportunities.

Rules:
- Use the extracted website content and metadata as your source.
- Separate facts from inference. Label inferred assumptions clearly (e.g. "Inferred:").
- Do not invent specifics like competitors, locations, or audiences unless labeled as inferred.
- Do not name specific publications, podcasts, newsletters, directories, or websites as prospecting targets unless they appear in the extracted page content. Prefer target categories (e.g. "design blogs", "indie SaaS newsletters") over named examples.
- Do not use status claims such as limited edition, official, partnered, featured, or endorsed unless those exact claims are clearly present in the extracted content.
- If the page is commercial or product-led (selling a product, SaaS signup, paid service, etc.), flag this clearly and explain how it affects outreach opportunities (e.g. harder to earn editorial features, better fit for tool directories or review roundups).
- Do not generate search queries.
- Do not optimize for paid links, link exchanges, or spammy backlink tactics.
- Focus on legitimate editorial discovery and outreach opportunities.
- Write in plain language. Use section headings exactly as listed below.
- Return only the brief text. No preamble, no JSON, no markdown code fences.`;

export const BRIEF_SECTION_HEADINGS = [
  "1. Project identity",
  "2. What it is",
  "3. Category and adjacent categories",
  "4. Audience",
  "5. Main use cases",
  "6. Linkable reason",
  "7. Linkable assets",
  "8. Prospecting targets",
  "9. Search vocabulary",
  "10. Exclusions",
  "11. Constraints",
  "12. Confidence",
] as const;

function truncateContent(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_CONTENT_CHARS)}\n\n[Content truncated for length.]`;
}

function formatMetadata(extraction: FetchAndExtractResult): string {
  const metadata = extraction.metadata;
  if (!metadata) {
    return "No metadata available.";
  }

  const lines = [
    `Title: ${metadata.title ?? "—"}`,
    `Description: ${metadata.description ?? "—"}`,
    `Canonical: ${metadata.canonical ?? "—"}`,
  ];

  const ogEntries = Object.entries(metadata.openGraph);
  if (ogEntries.length > 0) {
    lines.push("Open Graph:");
    for (const [key, value] of ogEntries) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  if (metadata.links.length > 0) {
    lines.push("Sample links from page:");
    for (const link of metadata.links.slice(0, 20)) {
      lines.push(`  - ${link.text || "(no text)"}: ${link.href}`);
    }
  }

  return lines.join("\n");
}

function formatExtractionStatus(extraction: FetchAndExtractResult): string {
  if (extraction.ok) {
    return "Extraction succeeded.";
  }

  return `Extraction had issues: ${extraction.reason} — ${extraction.message}`;
}

export function buildBriefUserPrompt(extraction: FetchAndExtractResult): string {
  const pageContent = extraction.ok
    ? extraction.contentMarkdown || extraction.contentText
    : extraction.contentMarkdown ?? extraction.contentText ?? "";

  const sections = BRIEF_SECTION_HEADINGS.map((heading) => `- ${heading}`).join(
    "\n",
  );

  return `Write a full prospecting brief for this project.

Website URL: ${extraction.finalUrl ?? extraction.requestedUrl}
Requested URL: ${extraction.requestedUrl}
${formatExtractionStatus(extraction)}

Page metadata:
${formatMetadata(extraction)}

Page content:
${pageContent ? truncateContent(pageContent) : "No readable page content was extracted."}

Include all of these sections with the exact headings:

${sections}

Section guidance:
- Project identity: project name, website URL, one-sentence description.
- What it is: describe the product, creator, project, site, tool, app, newsletter, portfolio, community, or resource. Note if the page is commercial or product-led.
- Category and adjacent categories: main category plus related categories people may describe differently.
- Audience: who this is for, including adjacent audiences; mark uncertain assumptions clearly.
- Main use cases: what people use it for or why they would care.
- Linkable reason: why another site would naturally mention or link to it. Do not claim prior features, partnerships, or endorsements unless stated on the page.
- Linkable assets: free tools, guides, templates, data, examples, galleries, articles, calculators, communities, etc.
- Prospecting targets: kinds of pages to find (resource pages, directories, roundups, newsletters, podcasts, communities, review sites, alternatives pages, niche blogs, etc.). Use categories only — do not name specific publications or sites unless they appear in the extracted content.
- Search vocabulary: terms from the site, outsider terms, synonyms, niche terms, audience terms, problem/use-case terms.
- Exclusions: noisy result types to avoid (jobs, courses, agencies, spam directories, marketplaces, login pages, the project's own domain, etc.).
- Constraints: language, geography, freshness if known, whether to exclude the project's own domain. If commercial/product-led, note how that should shape outreach (e.g. prioritize tool lists and comparisons over pure editorial features).
- Confidence: what was clearly found on the website, what was inferred, what is missing or uncertain. State whether the page appears commercial/product-led and how confident you are.`;
}
