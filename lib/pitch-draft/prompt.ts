import type { SiteCheckSummary, SiteEvidence } from "../site-check/types.ts";
import type { PublicationPage, PublicationReading } from "./read-publication.ts";
import type { PitchChannel } from "./types.ts";

const MAX_POST_TITLES = 12;

const EMAIL_JSON_EXAMPLE = JSON.stringify(
  {
    siteName: "Their name.",
    to: "Editorial address.",
    subject: "Subject line.",
    greeting: "Hi Poppy,",
    anchor: "The paragraph about their piece, the lesson and how he used it.",
    project: "The paragraph introducing the print.",
    readers: "Why their readers would enjoy it.",
    formFields: [],
  },
  null,
  2,
);

const FORM_JSON_EXAMPLE = JSON.stringify(
  {
    siteName: "Their name.",
    to: null,
    subject: "Title for their form.",
    greeting: "Hi Slanted team,",
    anchor: "The paragraph about their piece, the lesson and how he used it.",
    project: "The paragraph introducing the print.",
    readers: "Why their readers would enjoy it.",
    formFields: [{ label: "A field their form asks for", value: "What to fill in." }],
  },
  null,
  2,
);

export const PITCH_DRAFT_SYSTEM_PROMPT = `You write the parts of the email Jasper sends to a publication to offer his print as something their readers would enjoy. His fixed frame goes around your parts: after the greeting comes "I'm Jasper, a graphic designer from Amsterdam.", and after your parts come his links, an offer of images and his sign-off. So don't write an introduction, links or a closing yourself.

Before writing, read our assessment of the publication: what they publish, what kind of outside work they feature, and the angle for positioning the print. Build every part on that angle.

Write in plain, simple English: short sentences and everyday words. English is not Jasper's first language. Never use em dashes (—) or en dashes (–); use a full stop, comma or colon instead.

The parts:
- greeting: "Hi [first name]," when their pages name an editor, otherwise "Hi [publication] team,".
- anchor: Start from one specific piece on their pages. Say what he read, the one practical lesson he took from it (explained so someone outside design would understand), and how that lesson changed the way he made this print, with the concrete things he did. Write it as his own experience.
- project: Introduce the print by name: what it is, why he made it (the reason given on his pages), the fact that makes it interesting, and what the result is as someone sees it (not paper or print specs).
- readers: Why their readers in particular would enjoy it, following the angle.
- subject: A plain subject line.

Across the parts, say each fact once: details used in the anchor are not repeated in the project or readers part.

How Jasper sounds: warm, casual and understated. He doesn't plead, prove himself, explain his philosophy, add disclaimers about the subject (such as "you don't need to care about X"), or claim how people respond to his work. Write fresh sentences; his pages are background facts, not text to copy.

Practical:
- Keep facts about the print and his background exactly as given. Never invent addresses, people, articles or what they said.
- Send to an editorial address rather than customer service, sales or advertising.
- For a form, fill only the fields that apply to a print and that his pages answer; leave the rest out.

Return only valid JSON matching the example shape. No preamble, no markdown fences.`;

function formatPage(page: PublicationPage): string {
  return `${ page.title } (${ page.url })
${ page.text }`;
}

function formatPostTitles(evidence: SiteEvidence): string {
  const titles = [...evidence.posts, ...evidence.similarPosts]
    .slice(0, MAX_POST_TITLES)
    .map((post) => {
      const date = post.publishedAt?.slice(0, 10) ?? "no date";
      return `- [${ date }] ${ post.title }`;
    });

  return titles.length > 0 ? titles.join("\n") : "None found.";
}

export function buildPitchDraftUserPrompt(
  profile: string,
  projectContext: string,
  evidence: SiteEvidence,
  reading: PublicationReading,
  summary: SiteCheckSummary,
  channel: PitchChannel,
): string {
  const jsonExample = channel === "form" ? FORM_JSON_EXAMPLE : EMAIL_JSON_EXAMPLE;
  const submissionMethod = summary.submission.method;
  const emails = evidence.emails.length > 0 ? evidence.emails.join(", ") : "none found";
  const about = reading.about ? formatPage(reading.about) : "Not found.";
  const articles = reading.articles.length > 0
    ? reading.articles.map(formatPage).join("\n\n---\n\n")
    : "None could be read.";
  const submissionPage = evidence.submissionPage
    ? `${ evidence.submissionPage.url }\n${ evidence.submissionPage.text }`
    : "Not found.";

  return `Jasper's profile:
${ profile.trim() }

The print (his pages and their URLs):
${ projectContext.trim() }

The publication: ${ evidence.domain }
Homepage: ${ evidence.homepageTitle ?? "unknown" }. ${ evidence.homepageDescription ?? "" }

Our assessment of the publication:
- What they publish: ${ summary.topics } (${ summary.contentFormat })
- Outside work they feature: ${ summary.featuresOutsideWorkNote }
- Fit: ${ summary.fitNote }
- Angle: ${ summary.angle }

Their about page:
${ about }

Their recent post titles:
${ formatPostTitles(evidence) }

Some of their articles:
${ articles }

How they ask to be pitched: ${ submissionMethod || "unknown" }

Their submission or contact page:
${ submissionPage }

Email addresses found on their site: ${ emails }

Return JSON with this shape:
${ jsonExample }`;
}
