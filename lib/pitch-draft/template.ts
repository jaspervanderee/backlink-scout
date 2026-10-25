export type PitchParts = {
  greeting: string;
  anchor: string;
  project: string;
  readers: string;
};

export type PitchLinks = {
  guideURL: string | null;
  printURL: string | null;
};

const INTRO = "I'm Jasper, a graphic designer from Amsterdam.";
const CLOSING = "I'd be happy to provide high-resolution images or additional details about the process if it's of interest.";
const SIGN_OFF = "Warm regards,\nJasper van de Ree";

function formatLinks(links: PitchLinks): string {
  const lines = [
    links.guideURL ? `Design notes: ${ links.guideURL }` : "",
    links.printURL ? `The print: ${ links.printURL }` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

// Jasper's fixed frame; only the parts in between are written per publication.
export function composePitchEmail(parts: PitchParts, links: PitchLinks): string {
  const sections = [
    parts.greeting,
    INTRO,
    parts.anchor,
    parts.project,
    parts.readers,
    formatLinks(links),
    CLOSING,
    SIGN_OFF,
  ];

  return sections.filter((section) => section.trim()).join("\n\n");
}

// The project context lists the guide page first when there is one, then the print page.
export function readPitchLinks(projectContext: string): PitchLinks {
  const pageURLs = [...projectContext.matchAll(/^Page: (\S+)/gm)].map((match) => match[1]);
  if (pageURLs.length >= 2) {
    return { guideURL: pageURLs[0], printURL: pageURLs[1] };
  }

  return { guideURL: null, printURL: pageURLs[0] ?? null };
}
