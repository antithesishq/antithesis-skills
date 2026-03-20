---
name: antithesis-triage
description: >
  Use this skill to triage bugs found by Antithesis using the `agent-browser`
  skill to control a headless Chromium browser. If you are about to check run
  status, read property results, inspect findings, view environment images, or
  extract any information from the triage report — you MUST use this skill
  first. Covers runs page, run metadata (title, date, run/session IDs), property
  statuses (passed/failed/unfound), environment source images, findings,
  utilization metrics, and run logs.
keywords:
  - antithesis
  - triage report
  - bug report
  - properties
  - findings
  - environment
  - utilization
  - logs
  - run status
  - triage results
  - run metadata
---

# Antithesis Bug Triage

Use the `agent-browser` skill to read and triage Antithesis test reports.

## Gathering user input

Before starting, collect the following from the user:

1. **Report URL or Tenant ID** (required) — A full triage report URL like `https://TENANT.antithesis.com/...` or just the tenant name. If neither is provided, ask the user.
2. **What they want to know** — Are they investigating a specific failure? Getting a general overview? Comparing runs? This determines which workflow to follow.

## Reference files

Each reference file contains the selectors and query file paths for a specific
task. Read the relevant file before performing that task.

| Page                          | When to read                                               |
| ----------------------------- | ---------------------------------------------------------- |
| `references/setup-auth.md`    | Always — read first to set up the browser session          |
| `references/run-discovery.md` | User wants to find or browse recent runs (no specific URL) |
| `references/run-metadata.md`  | Need run title, date, or the Explore Logs link             |
| `references/properties.md`    | Checking property pass/fail status, filtering properties   |
| `references/environment.md`   | Checking which Docker images were used                     |
| `references/findings.md`      | Viewing behavioral diffs between runs                      |
| `references/utilization.md`   | Checking test hours or behavior discovery rate             |
| `references/logs.md`          | Investigating logs for a specific property example         |
| `references/finding-analysis.md` | RCA workflow: analyzing a finding by comparing failing/passing examples |

## Query files

Reference files contain references to queries. Queries are stored in the assets directory, organized by the page they are relevant to.

Use the following command pattern to evaluate a query file from the skill root:

```
cat assets/report/run-metadata.js \
  | agent-browser eval --session-name "$SESSION" --stdin
```

Do not run report queries in parallel with `agent-browser open`, hash-route
navigation, or any other command that can replace the page. Wait until the
target page is settled before starting `eval` calls. On a single browser
session, run report queries sequentially; property scripts mutate tab and
expansion state and will interfere with each other if you launch them in
parallel.

## Page Loading Checks

Each page type has a dedicated `loading-finished.js` query. Use the matching
one before running page-specific queries.

Command pattern:

```
for _ in $(seq 1 60); do
  if [[ "$(
    cat <loading-query-file> \
      | agent-browser eval --session-name "$SESSION" --stdin
  )" == "true" ]]; then
    break
  fi
  sleep 1
done
```

If the report page still is not ready after about 60 seconds, inspect the
current state before retrying:

```
cat assets/report/loading-status.js \
  | agent-browser eval --session-name "$SESSION" --stdin
```

Use these loading checks:

- Report page: `assets/report/loading-finished.js`
- Finding page: `assets/finding/loading-finished.js`
- Logs page: `assets/logs/loading-finished.js`
- Runs page: `assets/runs/loading-finished.js`

The report-page loading check returns `true` only when the main report
sections have finished loading, including findings, properties, environment,
and utilization. The report hydrates asynchronously after the browser `load`
event, and findings are often the last section to settle.

Report queries are only valid on the main report view. If you navigate to an
internal hash route such as `#/run/.../finding/...`, reopen the original report
URL and rerun `assets/report/loading-finished.js` before using report queries
again.

## Recommended workflows

### Quick overview of a run

1. Read `references/setup-auth.md` — authenticate and open the report
2. Read `references/run-metadata.md` — get the run title and date
3. Read `references/properties.md` — use the all-properties query for totals, then failed/passed/unfound queries only if you need filtered subsets
4. Summarize: total properties, how many passed/failed/unfound, and flag any failures

### Investigate a failing property

1. Read `references/setup-auth.md` — authenticate and open the report (skip auth for public report URLs)
2. Read `references/properties.md` — list properties, filter to failed
3. Read `references/findings.md` — get findings with URLs to collect finding page links
4. Navigate to the finding page (click a finding from the report, or open a finding URL directly)
5. Read `references/finding-analysis.md` — compare failing vs passing examples, extract fault events, and identify the root cause
6. Report the failure with: property name, assertion text, fault injection trigger, a comparison table, and **links to the finding page and specific examples**

### RCA all failed properties

Use this workflow when the user wants a comprehensive review of all failures in a run.

1. Read `references/setup-auth.md` — authenticate and open the report (skip auth for public report URLs)
2. Read `references/run-metadata.md` — get the run title, date, and source
3. Read `references/properties.md` — get all properties for totals, then filter to failed
4. Read `references/findings.md` — get findings with URLs (the query returns `url` per finding); filter to only **new** findings — ongoing and resolved findings do not require RCA
5. Match new findings to the failed properties from step 3; group related failed properties by shared root cause (e.g. watch failures together, container exits together)
6. For each failure group with new findings, navigate to the finding page and follow the RCA workflow in `references/finding-analysis.md`
7. Produce the final output using the **Full RCA report format** defined in `references/finding-analysis.md` — include finding links in property tables, linked example headers in fault correlation tables, and a summary table with finding and evidence links

### Find a specific run

1. Read `references/setup-auth.md` — authenticate
2. Read `references/run-discovery.md` — browse the runs page to find the target run
3. Continue with any of the above workflows once on the report

## General guidance

- **Always authenticate first.** Every session starts with setup-auth.
- **Don't fabricate selectors.** The triage report uses custom web components and non-obvious class names. Always consult the resource page for the correct queries.
- **Keep report queries on the main report view.** If you click into a finding-focused hash route, reopen the original report URL before using report queries again.
- **Do not overlap navigation with queries.** `agent-browser eval` calls can fail with an execution-context-destroyed error if the report is still navigating or hydrating.
- **Logs require full auth.** The report page may load with just an `auth` token in the URL, but navigating to log pages requires a fully authenticated session.
- **Logs use virtual scrolling.** Only ~50-70 rows render at a time. Use the filter-based approach (see `references/finding-analysis.md`) to narrow results before scraping.
- **Prefer structured data over log scraping.** Assertion details decoded from URLs and the Details panel provide authoritative, structured data. Use log scraping only for fault injection timeline context.
- **Use filters for large log sets.** When the inline log viewer shows more than ~70 items, apply a filter (e.g., `fault:{`) before reading events. This makes virtual scrolling irrelevant.
- **Finding pages load asynchronously.** Use `assets/finding/loading-finished.js` before running finding queries, just as you use the report loading check for report queries.
- **Present results clearly.** When reporting property statuses, use a table or list. When reporting log findings, include the virtual timestamp, source, and log text.
