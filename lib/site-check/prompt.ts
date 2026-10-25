import type { SiteEvidence, SitePost } from "./types";

const MAX_POSTS_IN_PROMPT = 15;

export const SITE_CHECK_JSON_EXAMPLE = JSON.stringify(
  {
    topics: "One sentence: what this site writes about.",
    contentFormat: "One short phrase, e.g. image-led product posts, long text essays without images.",
    featuresOutsideWork: "yes | rarely | no | unclear",
    featuresOutsideWorkNote: "One sentence citing specific recent posts.",
    closestPrecedent: {
      title: "Exact post title from the evidence",
      url: "Exact post URL from the evidence",
      why: "Why this post is the closest match to the print.",
    },
    fitNote: "One sentence: does this print suit their audience and format?",
    angle: "How to position the print for this publication's readers, in plain words.",
    submission: {
      method: "How to submit, e.g. email to submit@example.com, or an upload form that needs an account.",
      materials: ["What to send, with exact numbers, e.g. at least 6 images, 2,600px wide, RGB."],
      information: ["What to tell them, e.g. short bio, location, project description."],
      rules: ["Rules and expectations, e.g. wait 28 days before following up; no reply guaranteed."],
      paidOnly: false,
    },
    lean: "good | unsure | poor",
    leanReason: "One sentence.",
  },
  null,
  2,
);

export const SITE_CHECK_SYSTEM_PROMPT = `You help an independent print designer decide whether a website is worth pitching for a free editorial feature that links to their work.

You do not make the decision. You summarize the evidence so the designer can decide in 30 seconds. Use only the evidence provided; never invent posts, dates, or routes.

Checklist:
- topics: what the site writes about.
- contentFormat: how posts look (image-led, text-only, video, product listings). A text-only site cannot show a print well.
- featuresOutsideWork: "yes" when several recent posts cover work by unaffiliated people or companies and link to them; "rarely" when that happens only occasionally; "no" when posts promote the site's own products or services, or never link out; "unclear" when evidence is too thin.
- closestPrecedent: the one listed post (recent or older) most similar to this print (posters, prints, infographics, design or typography objects, or the same subject). Copy its title and URL exactly. Use null if nothing is similar.
- fitNote: whether the print suits the site's audience and format.
- angle: how to position the print for this publication: which side of it their readers would care about, given what they feature.
- submission: the site's own submission requirements, taken only from the submission page text and the routes and emails found. Keep items short and copy numbers exactly (image counts, sizes, waiting times, prices). Leave a list empty when the page says nothing about it. If no submission page was read, describe the best known route in method and say the requirements are unknown. Set paidOnly to true only when every route to coverage costs money; a free route next to paid options is false. When paidOnly is true, lean is "poor".
- lean:
  - "poor" when the site looks inactive (no post in the last 12 months), only offers paid placement, only features its own work, or its format cannot show a print.
  - "unsure" when evidence is thin, or for very large outlets that rarely feature independent creators.
  - "good" when it actively features comparable outside work with links.
  Never lean "poor" only because a site is small.

Return only valid JSON matching the example shape. No preamble, no markdown fences.`;

function formatPosts(posts: SitePost[]): string {
  if (posts.length === 0) {
    return "No posts found.";
  }

  return posts
    .slice(0, MAX_POSTS_IN_PROMPT)
    .map((post, index) => {
      const date = post.publishedAt?.slice(0, 10) ?? "no date";
      const outbound = post.outboundDomains.length > 0
        ? post.outboundDomains.slice(0, 5).join(", ")
        : "none found";
      const position = index + 1;
      return `${ position }. [${ date }] ${ post.title }
   url: ${ post.url }
   links out to: ${ outbound }
   excerpt: ${ post.excerpt }`;
    })
    .join("\n");
}

function formatRoutes(evidence: SiteEvidence): string {
  const routeLines = evidence.routes
    .slice(0, 6)
    .map((route) => `- ${ route.kind }: ${ route.label } (${ route.url })`);
  const emailLine = evidence.emails.length > 0
    ? `- emails: ${ evidence.emails.join(", ") }`
    : "- emails: none found";
  const paidLines = evidence.paidSignals.map((signal) => `- paid signal: ${ signal }`);

  return [...routeLines, emailLine, ...paidLines].join("\n");
}

function formatSubmissionPage(evidence: SiteEvidence): string {
  const page = evidence.submissionPage;
  if (!page) {
    return "Submission page text: none was read.";
  }

  return `Submission page text (${ page.kind } page, ${ page.url }):
${ page.text || "(empty)" }`;
}

export function buildSiteCheckUserPrompt(
  evidence: SiteEvidence,
  projectContext: string,
  today: string,
): string {
  const latest = evidence.latestPostAt?.slice(0, 10) ?? "unknown";
  const notes = evidence.notes.length > 0 ? evidence.notes.join(" ") : "None.";

  return `Today is ${ today }.

The print being pitched:
${ projectContext.trim() }

Site: ${ evidence.domain }
Homepage title: ${ evidence.homepageTitle ?? "unknown" }
Homepage description: ${ evidence.homepageDescription ?? "unknown" }
Posts source: ${ evidence.postSource }
Latest post: ${ latest }
Posts in the last 90 days (of those listed): ${ evidence.postsLast90Days }
Collection notes: ${ notes }

Recent posts:
${ formatPosts(evidence.posts) }

Older posts about prints, posters, or design (from search; only the first few were opened to check links):
${ formatPosts(evidence.similarPosts) }

Contact and submission routes found:
${ formatRoutes(evidence) }

${ formatSubmissionPage(evidence) }

Return JSON with this shape:
${ SITE_CHECK_JSON_EXAMPLE }`;
}
