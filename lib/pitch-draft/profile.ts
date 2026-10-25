import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_PROFILE_PATH = "profile.md";

export function readProfile(): string | null {
  const profilePath = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.PROFILE_PATH?.trim() || DEFAULT_PROFILE_PATH,
  );
  return existsSync(profilePath) ? readFileSync(profilePath, "utf8") : null;
}
