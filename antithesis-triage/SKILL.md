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

Every triage run should use:

- a fresh, unique `SESSION` value such as `antithesis-triage-$(date +%s)-$$`

Use `--session-name antithesis` so `agent-browser` manages shared
authentication state automatically, while `--session "$SESSION"` keeps each
triage run isolated from other concurrent agents. Close the unique live session
when triage is complete.

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

## Runtime injection

Use the browser-side runtime file:

- `assets/antithesis-triage.js`

Inject it into the current page with:

```bash
cat assets/antithesis-triage.js \
  | agent-browser --session "$SESSION" eval --stdin
```

Injecting the file registers methods on `window.__antithesisTriage`. Call those
methods with `agent-browser eval`.

Synchronous method pattern:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getRunMetadata()"
```

Async method pattern:

```bash
agent-browser --session "$SESSION" eval \
  "(async () => window.__antithesisTriage.runs.getRecentRuns())()"
```

If `window.__antithesisTriage` is missing, inject `assets/antithesis-triage.js` and retry the method call.

Do not run method calls in parallel with `agent-browser open`, hash-route
navigation, or any other command that can replace the page. Wait until the
target page is settled before starting `eval` calls. On a single browser
session, run report queries sequentially; property methods mutate tab and
expansion state and will interfere with each other if you launch them in
parallel.

After every `open` call or any interaction that may navigate or replace the
page, first confirm that the browser has landed on the expected page type by
waiting on `window.location`, then inject `assets/antithesis-triage.js`, then call the
matching `waitForReady()` method before running page-specific methods. If a
method call reports that `window.__antithesisTriage` is missing, inject and
retry.

## Page Loading Checks

Each page type has async wait methods. After navigation, first verify that the
browser is on the page you expected with `agent-browser wait --fn`, inject the
runtime, then call the matching wait method before running page-specific
queries.

Use checks like these:

- Runs page:
  `agent-browser --session "$SESSION" wait --fn "window.location.pathname === '/runs'"`
- Report page:
  `agent-browser --session "$SESSION" wait --fn "window.location.pathname.startsWith('/report/')"`
- Logs page:
  `agent-browser --session "$SESSION" wait --fn "window.location.pathname === '/search' && new URLSearchParams(window.location.search).has('get_logs')"`

This catches slow loads and auth redirects. If the browser lands on an unexpected
page such as a login or Google auth flow, stop and reauthenticate before
continuing.

Use these wait methods to make sure the page is fully loaded before running other runtime methods:

- Report page: `window.__antithesisTriage.report.waitForReady()`
- Logs page: `window.__antithesisTriage.logs.waitForReady()`
- Runs page: `window.__antithesisTriage.runs.waitForReady()`

Example:

```bash
agent-browser --session "$SESSION" eval \
  "(async () => window.__antithesisTriage.report.waitForReady())()"
```

Each wait method polls for up to about 60 seconds by default and returns a
result object with `ok`, `ready`, `attempts`, and `waitedMs`. On timeout, the
result also includes `details`.

Use the lower-level boolean checks when you need a one-shot probe:

- Report page: `window.__antithesisTriage.report.loadingFinished()`
- Logs page: `window.__antithesisTriage.logs.loadingFinished()`
- Runs page: `window.__antithesisTriage.runs.loadingFinished()`

If the report page still does not become ready, inspect:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.loadingStatus()"
```

Equivalent one-shot status probes are also available at
`window.__antithesisTriage.logs.loadingStatus()` and
`window.__antithesisTriage.runs.loadingStatus()`.

The report-page loading check returns `true` only when the main report
sections have finished loading, including findings, properties, environment,
and utilization. The report hydrates asynchronously after the browser `load`
event, and findings are often the last section to settle.

Report queries are only valid on the main report view. If you navigate to an
internal hash route such as `#/run/.../finding/...`, reopen the original report
URL, wait until `window.location.pathname.startsWith('/report/')`, inject
`assets/antithesis-triage.js`, and rerun
`window.__antithesisTriage.report.waitForReady()` before using report methods
again.

## Recommended workflows

### Quick overview of a run

1. Read `references/setup-auth.md` — authenticate and open the report
2. Read `references/run-metadata.md` — get the run title and date
3. Read `references/properties.md` — use the all-properties query for totals, then failed/passed/unfound queries only if you need filtered subsets
4. Summarize: total properties, how many passed/failed/unfound, and flag any failures

### Investigate a failing property

1. Read `references/setup-auth.md` — authenticate and open the report
2. Read `references/properties.md` — list properties, filter to failed
3. Read `references/logs.md` — expand failed-property example tables, get log URLs, navigate to logs, find the highlighted assertion event and surrounding context
4. Report the failure with: property name, assertion text, relevant log lines, and the timeline context

### Find a specific run

1. Read `references/setup-auth.md` — authenticate
2. Read `references/run-discovery.md` — browse the runs page to find the target run
3. Continue with any of the above workflows once on the report

## General guidance

- **Always authenticate first.** Every session starts with setup-auth.
- **Use disposable sessions.** Generate a unique `SESSION` for each triage run,
  pair it with the shared `--session-name antithesis`, and `agent-browser
--session "$SESSION" close` when you finish or abort.
- **Inject the runtime after navigation.** After every `open`, after link clicks
  that may change pages, and after reopening the report from a finding route,
  wait until `window.location` matches the expected page, inject
  `assets/antithesis-triage.js`, then use the matching `*.waitForReady()`
  method before the next page-specific method call.
- **Retry missing-runtime errors by reinjecting.** If a command fails because
  `window.__antithesisTriage` is undefined or missing, inject the runtime and
  rerun the same method.
- **Don't fabricate selectors.** The triage report uses custom web components and non-obvious class names. Always consult the resource page for the correct queries.
- **Keep report queries on the main report view.** If you click into a finding-focused hash route, reopen the original report URL before using report queries again.
- **Do not overlap navigation with queries.** `agent-browser eval` calls can fail with an execution-context-destroyed error if the report is still navigating or hydrating.
- **Logs require full auth.** The report page may load with just an `auth` token in the URL, but navigating to log pages requires a fully authenticated session.
- **Logs use virtual scrolling.** Only ~50-70 rows render at a time. You may need to scroll to find specific entries.
- **Present results clearly.** When reporting property statuses, use a table or list. When reporting log findings, include the virtual timestamp, source, and log text.

## Self-Review

Before declaring this skill complete, review your work against the criteria below. This skill's output is conversational (summaries, tables, analysis), so the review should happen in your current context. Re-read the guidance in this file, then systematically check each item below against the answers and analysis you produced.

Review criteria:

- Every property status reported (passed, failed, unfound) was extracted from the actual triage report, not inferred or assumed
- Findings reference specific data from the report — property names, assertion text, log lines, timestamps
- No selectors or report data were fabricated — all queries used the reference files' prescribed query files
- Failed properties include actionable context: the assertion text, relevant log lines, and timeline context
- The summary distinguishes between what the report shows and what you interpret or recommend
- If comparing runs, differences are grounded in data from both reports, not just one
