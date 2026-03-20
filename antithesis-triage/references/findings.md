# Findings

The Findings section shows a history of test runs, which essentially presents a diff of your software's behavior from one run to the next.

Findings are contained by `section.section_findings`. The section often stays in
`Loading...` briefly after the rest of the report renders, so wait for report
loading to finish before running the findings query.

Use this query file:

- `assets/report/findings-grouped.js`

The script returns date groups, each containing findings with `status`
(new/resolved/rare), `property` (the finding name), and `url` (the finding
page URL).
