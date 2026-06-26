# Backlink Scout

A lightweight discovery and outreach-tracking tool for solo founders, indie hackers, artists, and other independent creators.

The user submits a project URL. The tool researches the project, searches for relevant websites, investigates how those websites actually publish, and ranks domains by one governing question:

> How likely is free outreach to this domain to result in a public feature with a backlink?

The MVP finds and qualifies domains. It does not find contacts, write outreach messages, send email, or measure SEO authority.

## Product Goal

Return at least a dozen genuinely qualified outreach opportunities, aiming for approximately 25 when the available evidence supports them.

Results are grouped into:

- **Promising**: strong evidence that the domain may feature this specific project for free on a public page with a backlink.
- **Maybe**: plausible opportunity, but one or more important claims remain uncertain.
- **Skip**: evidence contradicts the desired outcome or indicates a poor opportunity.

Approved domains move into a kanban-style outreach tracker.

## User Experience

The normal flow should remain simple:

1. User submits a project URL.
2. The tool reads and understands the project.
3. The tool searches for and investigates potential domains.
4. The user reviews ranked results with concise reasons and evidence.

The user should not need to complete a structured project form.

If the submitted page is blocked, too thin, mostly visual, or ambiguous, show a short editable project summary and ask the user to correct it before continuing. Otherwise, discovery should proceed without interruption.

## Fixed Campaign Goal

Every discovery run uses the same goal:

> Find domains likely to provide a free, earned, public feature that includes or is likely to include a backlink to the submitted project.

Paid placements, paid awards, advertisements, print-only coverage, PDF-only coverage, social-only mentions, and listings without likely backlinks do not satisfy this goal.

## Core Principles

### Behavior matters more than topical relevance

A website is not a good opportunity merely because it discusses the project's topic. It must demonstrate a habit of featuring comparable work from unaffiliated third parties.

### Evidence matters more than the search snippet

Search-result titles, snippets, and generated recommendation reasons are leads, not proof. The tool must investigate the domain before deciding.

### Publishing probability matters more than prestige

A small publication that regularly features independent projects should rank above a prestigious publication that rarely accepts or links to external work.

## MVP Pipeline

```text
Project URL
    |
    v
Read and understand project
    |
    v
Create search strategy and diverse search-native queries
    |
    v
Search through Perplexity
    |
    v
Normalize, deduplicate, and prefilter results
    |
    v
Gather a domain evidence pack
    |
    v
Apply the domain outreach judgment framework
    |
    v
Rank promising / maybe / skip
    |
    v
Approve domains into outreach kanban
```

## Scripts Versus LLMs

Use deterministic code for mechanical work and LLMs only where semantic interpretation is required.


| Task                                     | Implementation                    |
| ---------------------------------------- | --------------------------------- |
| Fetch pages and extract visible content  | Script                            |
| Normalize URLs and domains               | Script                            |
| Deduplicate results                      | Script                            |
| Apply obvious exclusions                 | Script                            |
| Track query yield                        | Script                            |
| Store, sort, and display results         | Script                            |
| Understand the submitted project         | LLM                               |
| Create the search strategy               | LLM                               |
| Generate diverse search-native queries   | LLM                               |
| Expand searches from successful patterns | LLM                               |
| Interpret domain evidence                | LLM                               |
| Make the final domain judgment           | LLM with deterministic guardrails |


Do not make final domain decisions from search snippets alone.

## Results UI

Show:

- Domain and site name
- `Promising`, `Maybe`, or `Skip`
- Opportunity score
- One-sentence reason
- Evidence links
- Approve and reject actions

The default shortlist should prioritize `promising` and `maybe` results. Keep skipped results available for debugging and quality review.

## Outreach Kanban

Approved domains move into a simple manual tracker:

```text
To contact -> Contacted -> Finished
```

Store final outcomes such as:

- Featured
- Declined
- No response
- Not suitable

Outcomes may later improve search and ranking, but automated learning is not required for the initial MVP.

## Recommended MVP Stack

Keep the implementation replaceable and local-first:

- **Application:** Next.js with App Router and TypeScript
- **Backend:** Next.js Server Actions and Route Handlers running on Node.js
- **Database:** SQLite
- **Frontend:** React, Tailwind CSS 4, and daisyUI 5
- **Search:** Perplexity API
- **Semantic reasoning:** DeepSeek or another configurable LLM provider
- **Page extraction:** Deterministic HTTP fetcher and HTML parser

Provider-specific logic should sit behind small interfaces so search and LLM vendors can be changed later.

## Quality Benchmark

Create a regression benchmark before tuning prompts or scores. It should contain known domains, the project used for evaluation, the expected decision, and the decisive evidence.

Initial examples from the World Cup poster evaluation:


| Domain type/example | Expected judgment  | Decisive reason                                                                  |
| ------------------- | ------------------ | -------------------------------------------------------------------------------- |
| Cultured Football   | Promising          | Relevant football-culture publisher with external-feature behavior               |
| It's Nice That      | Promising          | Design publication with credible independent-project coverage                    |
| Infographic Journal | Promising or maybe | Accepts relevant external submissions with likely public links                   |
| Phaidon             | Skip               | Prestige and topic fit do not establish an opportunity for unaffiliated products |
| Red Brick Design    | Skip               | Gift guide contains the site's own competing products                            |
| Cut+Paste Magazine  | Skip               | Submission route does not clearly produce the desired linked public webpage      |
| Artells Group       | Skip               | Publication is effectively paid promotion                                        |
| Graphis             | Skip               | Paid awards and own publications do not satisfy free earned outreach             |


Run the full pipeline against this benchmark after changes. Test actual outputs, not only prompt wording or architectural intent. Search plans are validated for publisher/editorial intent in each `queryText` (tiered strong/conditional signals) before Perplexity runs.

## Out of Scope

- Contact discovery
- Outreach-angle recommendations
- Email drafting or sending
- Automated follow-ups
- Paid-placement opportunities
- SEO authority or traffic metrics
- Multi-user accounts and permissions
- Complex automated learning from outcomes
