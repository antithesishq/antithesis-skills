---
name: antithesis-triage
description: >
  Use this skill to triage bugs found by Antithesis using `agent-browser` to
  control a headless Chromium browser. If you are about to check run status,
  read property results, inspect findings, view environment images, or extract
  any information from the triage report — you MUST load this skill first. Do
  NOT write manual DOM queries or JavaScript to scrape the triage report. This
  skill contains the correct CSS selectors and class names. Covers run metadata
  (title, date, run/session IDs), property statuses (passed/failed/unfound),
  environment source images, findings, utilization metrics, and run logs.
keywords:
  - antithesis
  - triage
  - properties
  - findings
  - environment
  - utilization
  - logs
  - run status
  - notebook results
  - passed
  - failed
  - run metadata
  - session id
---

# Antithesis Bug Triage

Use the `agent-browser` CLI to read and triage Antithesis test reports.

## Gathering user input

Before starting, collect the following from the user:

1. **Report URL or Tenant ID** (required) — A full triage report URL like `https://TENANT.antithesis.com/...` or just the tenant name. If neither is provided, ask the user.
2. **What they want to know** — Are they investigating a specific failure? Getting a general overview? Comparing runs? This determines which workflow to follow.

## Resource pages

Each page contains the CSS selectors, JS snippets, and `agent-browser` commands for a specific part of the triage report. Read the relevant page before performing that task. Do NOT guess selectors — always use the resource pages.

| Page                         | When to read                                               |
| ---------------------------- | ---------------------------------------------------------- |
| `resources/setup-auth.md`    | Always — read first to set up the browser session          |
| `resources/run-discovery.md` | User wants to find or browse recent runs (no specific URL) |
| `resources/run-metadata.md`  | Need run title, date, or the Explore Logs link             |
| `resources/properties.md`    | Checking property pass/fail status, filtering properties   |
| `resources/environment.md`   | Checking which Docker images were used                     |
| `resources/findings.md`      | Viewing behavioral diffs between runs                      |
| `resources/utilization.md`   | Checking test hours or behavior discovery rate             |
| `resources/logs.md`          | Investigating logs for a specific property example         |

## Evaluating JS snippets

Use the following command pattern to evaluate javascript snippets from the resource pages:

```
cat <<'EOF' | agent-browser eval --session-name $SESSION --stdin
// js code goes here
EOF
```

## Recommended workflows

### Quick overview of a run

1. Read `resources/setup-auth.md` — authenticate and open the report
2. Read `resources/run-metadata.md` — get the run title and date
3. Read `resources/properties.md` — list all properties with status
4. Summarize: total properties, how many passed/failed/unfound, and flag any failures

### Investigate a failing property

1. Read `resources/setup-auth.md` — authenticate and open the report
2. Read `resources/properties.md` — list properties, filter to failed
3. Read `resources/logs.md` — get log URLs from the failing property's examples, navigate to logs, find the highlighted assertion event and surrounding context
4. Report the failure with: property name, assertion text, relevant log lines, and the timeline context

### Find a specific run

1. Read `resources/setup-auth.md` — authenticate
2. Read `resources/run-discovery.md` — browse the runs page to find the target run
3. Continue with any of the above workflows once on the report

## General guidance

- **Always authenticate first.** Every session starts with setup-auth.
- **Don't fabricate selectors.** The triage report uses custom web components and non-obvious class names. Always consult the resource page for the correct queries.
- **Logs require full auth.** The report page may load with just an `auth` token in the URL, but navigating to log pages requires a fully authenticated session.
- **Logs use virtual scrolling.** Only ~50-70 rows render at a time. You may need to scroll to find specific entries.
- **Present results clearly.** When reporting property statuses, use a table or list. When reporting log findings, include the virtual timestamp, source, and log text.
