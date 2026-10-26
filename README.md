# Backlink Scout

A personal outreach tool for [Breen](https://www.breen.studio). It makes pitching prints to publications faster, so more pitches go out each week without lowering their quality.

The public page at `/` is a showcase. The working tool lives at `/dev`, which only runs locally or when `DEV_ROUTE_ENABLED=true`.

## What it does

For a print (shop page and optional blog post) and a list of sites:

1. Site check. Reads each site's recent posts (RSS, or search when a site blocks bots), checks whether it features and links to outside work, how active it is, how to submit, and whether it only offers paid placement. It gives a verdict (good, unsure, poor) and an angle: how to position the print for that site's readers.
2. Pitch draft. For good and unsure sites, writes an email (or form text) in Jasper's voice. The intro, links and closing are a fixed frame; the anchor, project paragraph and readers line are written for each publication from its own articles and the site check's angle.
3. Outreach sheet. Flags sites already in the Google Sheet. "Mark as sent" writes the pitch to the print's tab.

Next up: discovery, which finds new candidate sites for a print and skips everyone already contacted.

## Setup

```bash
npm install
npm run dev
```

Create `.env.local`:

```bash
JUDGMENT_LLM_PROVIDER=deepseek
JUDGMENT_LLM_API_KEY=...
JUDGMENT_LLM_MODEL=deepseek-flash
PERPLEXITY_API_KEY=...
OUTREACH_SHEET_ID=...
```

Private files in the project root, all gitignored:

- `google-service-account.json`: key for a Google service account with editor access to the outreach sheet.
- `profile.md`: Jasper's background, style and voice notes, read by the pitch writer.
- `approved-emails.md`: reference emails, not read by the tool.

## Evals

`evals/` holds known answers for scoring changes: the prints (`projects.json`) and labelled sites (`labels.tsv`). Batman is the holdout print.

```bash
npx tsx scripts/site-check.ts <project-id> [domain ...]
```

Checks every labelled site for a print (or the domains given) and prints a score per label. `npx tsx scripts/outreach-sheet.ts` lists the sheet's tabs and contacted sites (read only).
