# Backlink Scout — agent guide

## Purpose

- A personal outreach tool for Breen (Jasper van de Ree's print studio). Not a product.
- It also serves as a portfolio piece: outsiders, such as potential employers, should be able to try a limited public version. Keep personal data (sheet, profile, sending) out of anything public.
- Goal: more pitches per week without lowering their quality. Drafts should need barely any editing.
- Evidence over guesses: judge a site from its real posts, links and submission rules, never from a snippet.
- Simplicity first: few dependencies, no frameworks, no build step. Remove code before adding it.
- Plain English everywhere: in the UI, in drafts, in replies. English is not Jasper's first language.

See [README.md](README.md) for what the tool does and how to run it.

## Stack

- Node 24 runs the TypeScript in `lib/`, `scripts/` and `server.ts` directly (type stripping). No build.
- `server.ts`: local server on `127.0.0.1:3000`, serves `tool/` and JSON endpoints under `/api/`.
- `tool/`: the working UI in plain HTML, CSS and JavaScript.
- `site/`: the public showcase page, static HTML deployed to Vercel (`vercel.json`).
- Runtime dependencies: `linkedom` and `@mozilla/readability` only. Type-check with `npm run check`.

## Where code goes

| Location | Put here |
|---|---|
| `lib/<domain>/` | All logic. `types.ts` for types, `prompt.ts` for LLM prompts, `config.ts` for env vars |
| `server.ts` | Thin endpoints: read input, call `lib/`, return JSON |
| `tool/` | UI only; no logic that belongs in `lib/` |
| `scripts/` | Command-line helpers and evals |

Current flow: print URL + sites → site check (`lib/site-check/`) → pitch draft (`lib/pitch-draft/`) → outreach sheet (`lib/outreach-sheet/`). Discovery goes in `lib/discovery/`.

## Rules

- TypeScript imports: relative paths with the `.ts` extension, and `import type` for types. No enums, namespaces or other syntax Node can't strip.
- In `tool/`, set text from other websites with `textContent`, never `innerHTML`.
- Never write test rows to the real outreach sheet; use read-only checks.
- Private files stay gitignored: `.env.local`, `google-service-account.json`, `profile.md`, `approved-emails.md`.
- Score site check changes against `evals/` with `node scripts/site-check.ts <project-id>`.

## Code style

These override the global preferences for classes and 4-space indentation:

- 2-space indentation, K&R braces, functions instead of classes, kebab-case filenames, named exports.
- Results use `ok` / `message`, as in existing `lib/` code.
- Clear names, no abbreviations (except `min`, `max`, `temp`), no single-letter variables, uniform initialism casing (`userID`, `printURL`).
- No computed expressions inside template literal interpolations; pull them into named variables first.
- Comments only for a non-obvious why. When in doubt about naming, follow the Swift API Design Guidelines.
