function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readPath(printURL: string): string {
  try {
    return new URL(printURL).pathname;
  } catch {
    return printURL;
  }
}

// "/shop/movies/star-wars-poster" becomes "Star Wars" for a print without a tab yet.
function titleFromSlug(path: string): string {
  const slug = path.split("/").filter(Boolean).at(-1) ?? "";
  return slug
    .split("-")
    .filter((word) => word && word !== "poster" && word !== "print")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function chooseSheetTab(printURL: string, tabTitles: string[]): string {
  const path = readPath(printURL);
  const compactPath = compact(path);
  const matches = tabTitles.filter((title) => compact(title) && compactPath.includes(compact(title)));
  const existingTab = matches.sort((first, second) => second.length - first.length)[0];

  return existingTab ?? titleFromSlug(path);
}
