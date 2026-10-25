# Backlink Scout — agent guide

## Rule precedence

This repo uses **Next.js, React, TypeScript, Tailwind CSS, and daisyUI** with a build step.

Sections below override global preferences where they conflict. For product goals and pipeline, see [README.md](README.md).

**Overridden global preferences in this repo:**

- “Frontend: vanilla JS, no framework, no build step” — does not apply here.
- “Use classes generously” — does not apply; use functions and hooks in `.ts`/`.tsx`.
- “4-space indentation” — use **2 spaces** in `.ts`, `.tsx`, and config files here.
- Class-based file naming — use **kebab-case** filenames (`prospecting-flow.tsx`).

## Next.js

This is **not** the Next.js from older training data. APIs and conventions may differ.

Before assuming routing, caching, or data-fetching behavior, read `node_modules/next/dist/docs/`.

## Stack

Check [package.json](package.json) for installed versions. As of the last doc update: Next.js 16, React 19, Tailwind CSS 4, daisyUI 5, TypeScript 5.

- App Router only (`app/`).
- Tailwind 4 via `@import "tailwindcss"` in [app/globals.css](app/globals.css) — no `tailwind.config.js`.
- daisyUI via `@plugin "daisyui"` in `globals.css`.
- Import alias: `@/` → repo root.

## Where code goes

| Location | Put here |
|---|---|
| `app/page.tsx`, `app/layout.tsx` | Route shell, metadata, global layout |
| `app/components/` | Client UI (`"use client"`) |
| `app/actions/` | Server Actions (`"use server"`) — thin wrappers only |
| `lib/<domain>/` | Business logic, orchestration, deterministic helpers |
| `lib/<domain>/types.ts` | Domain types and result shapes |
| `lib/<domain>/prompt.ts` | LLM prompt strings |
| `app/globals.css` | Global tokens and theme only |

Current flow: URL → brief → search plan → search results → candidate prep → domain investigation (developer preview). Match existing action and `lib/` boundaries when extending.

Site check (`lib/site-check/`, on `/dev`): per-domain evidence summary — recent posts via RSS or search, outbound links, closest similar post, activity, submission routes and requirements, paid signals. Score changes against `evals/` with `npx tsx scripts/site-check.ts <project-id>`.

Pitch drafts (`lib/pitch-draft/`) are written for non-poor sites from the gitignored `profile.md`. The outreach Google Sheet (`lib/outreach-sheet/`, `OUTREACH_SHEET_ID` + gitignored `google-service-account.json`) is read to flag contacted sites, and "Mark as sent" appends a row. Never write test rows to the real sheet.

## Server / client boundaries

**Server components (default)** — pages and layout. No `"use client"` unless needed.

**Client components** — add `"use client"` when the file needs state, event handlers, or browser APIs (`clipboard`, `setTimeout`, etc.). All files in `app/components/` are client components today.

**Server Actions** — live in `app/actions/` with `"use server"`. Keep them thin: light input checks, then delegate to `lib/`. Call from client components via `useTransition` or form actions, as in [prospecting-flow.tsx](app/components/prospecting-flow.tsx).

**`lib/`** — all business logic. May be imported from client **only when pure/sync and secret-free** (e.g. `prepareCandidates`, format helpers). Config and API clients stay server-side.

**API routes** — none exist. Do not add `app/api/` unless Server Actions cannot fit (webhooks, third-party callbacks). Prefer Server Actions.

**Env vars** — read in `lib/*/config.ts` on the server only (`JUDGMENT_LLM_*`, `PERPLEXITY_*`). Never expose in client components.

## Styling

- **daisyUI** for buttons, cards, badges, alerts, forms, collapses (`btn`, `card`, `badge`, `alert`, `form-control`, `input`, `collapse`).
- **Tailwind utilities** for layout, spacing, responsive breakpoints.
- **No new custom CSS** except global tokens in `app/globals.css`.
- Copy existing patterns from [search-plan-preview.tsx](app/components/search-plan-preview.tsx) and [prospecting-flow.tsx](app/components/prospecting-flow.tsx).
- Mobile-first: `px-4 sm:px-6`, `w-full sm:w-auto`, `flex-wrap`, `sm:grid-cols-2`.
- Do not add another UI library.

## Coding conventions (this repo)

- Functions and hooks, not classes.
- K&R braces; pad inside braces: `{ market, side }`.
- Named exports for components and `lib/` functions; default export for Next.js pages/layout only.
- kebab-case filenames; PascalCase component names; props types named `{Component}Props`.
- MVP scope — minimal code, reuse before creating.
- Result types use `ok` / `message` (or similar) — follow existing `lib/` patterns.

## Do / Don't

**Do**

- Reuse existing components and `lib/` patterns.
- Prefer daisyUI for common UI.
- Check local Next.js docs for version-specific behavior.
- Put logic in `lib/`, not in actions or components.

**Don't**

- Apply the global vanilla-JS frontend rule here.
- Add API routes when a Server Action fits.
- Add another UI library or new styling system.
- Use classes in React/TS files.
- Duplicate product requirements from README into code comments or docs.

## Shared preferences (still apply)

From global coding preferences — unchanged unless overridden above.

**Dependencies** — minimal; earn their place; prefer platform/stdlib first.

**Backend** — Node.js (via Next server runtime).

**Naming & clarity** — clarity over brevity; no abbreviations except `min`, `max`, `temp`; no single-letter variables; uniform initialism casing (`userID`, `HTTPServer`).

**Template literals** — avoid computed expressions inside interpolations; pull arithmetic, ternaries, and calls into named variables first.

**Comments** — only for non-obvious *why*; code should read clearly on its own.

**When in doubt** — Apple Swift API Design Guidelines for naming and API shape.
