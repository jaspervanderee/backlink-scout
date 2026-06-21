import type { FetchAndExtractResult } from "@/lib/fetch-and-extract";

const MAX_CONTENT_CHARS = 12_000;

export const BRIEF_SECTION_HEADINGS = [
  "1. Project identity",
  "2. Product context",
  "3. Audience and uses",
  "4. Link strategy",
  "5. Discovery signals",
  "6. Constraints, risks, and grounding",
] as const;

export const BRIEF_SYSTEM_PROMPT = `You write prospecting briefs for backlink and mention discovery.

Your job is to understand a project from extracted website content and write a structured plain-text brief that another system can later use to find legitimate editorial outreach opportunities.

Rules:
- Use the extracted website content and metadata as your source.
- Separate facts from inference. Label inferred assumptions clearly (e.g. "Inferred:").
- Do not invent specifics like competitors, locations, or audiences unless labeled as inferred.
- Do not name specific publications, podcasts, newsletters, directories, or websites as prospecting targets unless they appear in the extracted page content. Prefer target categories over named examples.
- Do not use status claims such as limited edition, official, partnered, featured, or endorsed unless those exact claims are clearly present in the extracted content.
- If the page is commercial or product-led, flag this once in section 2 with a single sentence on how it affects outreach. Do not repeat the commercial flag elsewhere.
- Do not list generic exclusions (jobs, courses, agencies, spam directories, marketplaces, login pages, own domain). Those are handled elsewhere. In section 6, include only project-specific risks and avoid-notes that would change search or outreach strategy.
- Say each important fact once in the most appropriate section. Do not restate embed strategy, key counts, or link hooks in multiple sections.
- Do not generate search queries.
- Do not optimize for paid links, link exchanges, or spammy backlink tactics.
- Focus on legitimate editorial discovery and outreach opportunities.
- Write in plain language. Use section headings exactly as listed below.
- Return only the brief text. No preamble, no JSON, no markdown code fences.`;

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

  return `Write a prospecting brief for this project.

Website URL: ${extraction.finalUrl ?? extraction.requestedUrl}
Requested URL: ${extraction.requestedUrl}
${formatExtractionStatus(extraction)}

Page metadata:
${formatMetadata(extraction)}

Page content:
${pageContent ? truncateContent(pageContent) : "No readable page content was extracted."}

Include all of these sections with the exact headings:

${sections}

Section guidance (keep each section concise; avoid repeating facts across sections):
- Project identity: project name, website URL, one-sentence description.
- Product context: what the product/project/site is; main and adjacent categories; whether the page is commercial or product-led and one sentence on outreach implication.
- Audience and uses: who it is for (label inferences) and primary use cases in one combined section.
- Link strategy: why another site would link and what concrete assets support it (embeds, guides, data, tools, galleries, etc.). Do not claim prior features, partnerships, or endorsements unless stated on the page.
- Discovery signals: target page categories to find (not named sites unless on the page) plus search vocabulary as short bullet lists (max ~5 terms each: site terms, outsider terms, niche terms, audience terms, use-case terms).
- Constraints, risks, and grounding: language and geography; freshness or timeliness if relevant; commercial or IP/licensing risks if relevant; project-specific avoid-notes for search/outreach (e.g. unlikely major news coverage, franchise fan-art context, paid-only directories); what was clearly found vs inferred vs missing. Do not repeat facts already stated above.`;
}
