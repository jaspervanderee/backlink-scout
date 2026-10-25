import { parseHTML } from "linkedom";
import { fetchStaticPage } from "@/lib/fetch-and-extract/fetch-static";

const MAX_CONTENT_CHARS_PER_PAGE = 900;
const INTRO_SELECTOR = '[class*="intro"], [class*="lead"], [class*="summary"]';

// Read pages in visible order: Readability can drop intros that sit outside the main article element.
async function readVisiblePage(url: string): Promise<{ title: string; description: string; text: string }> {
  const fetched = await fetchStaticPage(url);
  const { document } = parseHTML(fetched.html);
  const title = document.querySelector("title")?.textContent?.trim() ?? "unknown";
  const description = document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";

  for (const element of document.querySelectorAll("script, style, noscript, template, nav, footer")) {
    element.remove();
  }

  // Intros can come late in the HTML and be moved up with CSS, so read them first.
  const introText = Array.from(document.querySelectorAll(INTRO_SELECTOR))
    .map((element) => element.textContent ?? "")
    .join(" ");
  const bodyText = document.body?.textContent ?? "";
  const text = `${ introText } ${ bodyText }`.replace(/\s+/g, " ").trim();

  return { title, description, text: text.slice(0, MAX_CONTENT_CHARS_PER_PAGE) };
}

export async function buildProjectContext(urls: string[]): Promise<string> {
  const sections: string[] = [];

  for (const url of urls) {
    try {
      const page = await readVisiblePage(url);
      sections.push(`Page: ${ url }
Title: ${ page.title }
Description: ${ page.description }
Content: ${ page.text || "(could not be read)" }`);
    } catch {
      sections.push(`Page: ${ url }
Content: (could not be read)`);
    }
  }

  return sections.join("\n\n");
}
