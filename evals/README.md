# Evals

Known answers for scoring pipeline changes. Not training data.

- `projects.json`: the prints to run. `holdout` projects are only scored, never tuned against.
- `labels.tsv`: one row per project and domain.
- `competitors` in `projects.json`: studios selling similar prints. Not outreach targets; the sites linking to them are leads.

## Labels

A label describes how the site publishes, not whether it replied.

| Label | Meaning |
|---|---|
| `featured` | Featured this print with a link |
| `good_target` | Regularly features outside work for free with a public link, and fits this print |
| `long_shot` | Large outlet that rarely features independent prints |
| `not_a_fit` | Paid placement, inactive, or no public link |

No reply is never a reason for `not_a_fit`.

`confidence` is how sure the label is. Rows marked `low` are guesses that still need checking.

`source` is where the domain came from: `manual`, `competitor_backlinks`, `organic`, `readme_benchmark`, `backlink_scout`, `llm_baseline`, or `unknown`. When scoring a method, ignore rows that method produced — otherwise it is graded on its own suggestions.
