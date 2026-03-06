---
name: antithesis-triage
description: >
  Use this skill to triage bugs found by Antithesis using `agent-browser` to
  control a headless Chromium browser. If you are about to check run status,
  read property results, inspect findings, view environment images, or extract
  any information from the triage report — you MUST load this skill first.
  Covers runs page, run metadata (title, date, run/session IDs), property
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
  - notebook results
  - run metadata
---

# Antithesis Bug Triage

Use the `agent-browser` CLI to read and triage Antithesis test reports.

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

## Query files

Reference files contain references to queries. Queries are stored in the assets directory, organized by the page they are relevant to.

Use the following command pattern to evaluate a query file from the skill root:

```
cat assets/report/run-metadata.js \
  | agent-browser eval --session-name "$SESSION" --stdin
```

## Page Loading Checks

Each page type has a dedicated `loading-finished.js` query. Use the matching
one before running page-specific queries.

Command pattern:

```
until [[ "$(
  cat <loading-query-file> \
    | agent-browser eval --session-name "$SESSION" --stdin
)" == "true" ]]; do
  sleep 1
done
```

Use these loading checks:

- Report page: `assets/report/loading-finished.js`
- Logs page: `assets/logs/loading-finished.js`
- Runs page: `assets/runs/loading-finished.js`

The report-page loading check returns `true` only when the main report
sections have finished loading, including findings, properties, environment,
and utilization.

## Recommended workflows

### Quick overview of a run

1. Read `references/setup-auth.md` — authenticate and open the report
2. Read `references/run-metadata.md` — get the run title and date
3. Read `references/properties.md` — list all properties with status
4. Summarize: total properties, how many passed/failed/unfound, and flag any failures

### Investigate a failing property

1. Read `references/setup-auth.md` — authenticate and open the report
2. Read `references/properties.md` — list properties, filter to failed
3. Read `references/logs.md` — get log URLs from the failing property's examples, navigate to logs, find the highlighted assertion event and surrounding context
4. Report the failure with: property name, assertion text, relevant log lines, and the timeline context

### Find a specific run

1. Read `references/setup-auth.md` — authenticate
2. Read `references/run-discovery.md` — browse the runs page to find the target run
3. Continue with any of the above workflows once on the report

## General guidance

- **Always authenticate first.** Every session starts with setup-auth.
- **Don't fabricate selectors.** The triage report uses custom web components and non-obvious class names. Always consult the resource page for the correct queries.
- **Logs require full auth.** The report page may load with just an `auth` token in the URL, but navigating to log pages requires a fully authenticated session.
- **Logs use virtual scrolling.** Only ~50-70 rows render at a time. You may need to scroll to find specific entries.
- **Present results clearly.** When reporting property statuses, use a table or list. When reporting log findings, include the virtual timestamp, source, and log text.
