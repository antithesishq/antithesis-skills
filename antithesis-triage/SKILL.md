---
name: antithesis-triage
description: >
  Triage Antithesis test reports to understand what happened in a run: look
  up runs, check status, investigate failed properties (assertions), view
  metadata, download logs, inspect findings, and examine environmental
  details. Load after a run completes or when investigating a failure.
compatibility: Requires snouty (https://github.com/antithesishq/snouty), agent-browser (https://github.com/vercel-labs/agent-browser), and jq.
metadata:
  version: "2026-04-17 94e2698"
---

# Antithesis Report Triage

Use this skill to read and triage Antithesis test reports.

**Reference files:** This skill's `references/` directory contains detailed guides for specific tasks. Do NOT read them all up front — only read a reference file when you are told to. Each reference file is mentioned by name at the point where it is needed.

## Prerequisites

- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.
- DO NOT PROCEED if `agent-browser` is not installed. See `https://raw.githubusercontent.com/vercel-labs/agent-browser/refs/heads/main/README.md` for installation options.
- DO NOT PROCEED if `agent-browser` is older than version `v0.23.4`. You can upgrade with `agent-browser upgrade`.
- DO NOT PROCEED if `jq` is not installed. See `https://jqlang.org/download/` for installation options.

## Gathering user input

Before starting, collect the following from the user:

1. **Report URL or Tenant Name** (required) — A full triage report URL like `https://TENANT.antithesis.com/...` or just the tenant name. If neither is provided, check the `$ANTITHESIS_TENANT` environment variable. Only ask the user if you can't guess the tenant name.
2. **What they want to know** — Are they investigating a specific failure? Getting a general overview? Comparing runs? This determines which workflow to follow.

## Session management with `agent-browser`

`agent-browser` has two session variables:

- `--session`: the name of an unique, isolated browser instance
- `--session-name`: auto-save/restore cookies by name

Every triage run MUST use a unique `--session` value. Generate this variable once and reuse it whenever you see `$SESSION` referenced by this skill.

```sh
SESSION=`antithesis-triage-$(date +%s)-$$`
```

Use `--session-name antithesis` on the FIRST `agent-browser` command that references a new `$SESSION`. This creates the session and restores saved cookies. Subsequent commands for the same `$SESSION` do not need `--session-name` — the session already exists.

Make sure you close the unique live session when triage is complete.

```sh
agent-browser --session $SESSION close
```

## Authentication

Do NOT navigate to the home page just to check auth. Instead, navigate directly to your target URL (report, runs page, etc.) using the session-creation command:

```
agent-browser --session "$SESSION" --session-name antithesis open "$TARGET_URL"
agent-browser --session "$SESSION" wait --load networkidle
agent-browser --session "$SESSION" get url
```

If the URL starts with `https://$TENANT.antithesis.com` then you are authenticated. If it redirected to a login page, you need to authenticate — read `references/setup-auth.md`.

## Runtime injection

The triage skill makes heavy use of an injected runtime API. Inject the runtime into the current page after navigation completes:

```bash
cat assets/antithesis-triage.js \
  | agent-browser --session "$SESSION" eval --stdin
```

The runtime registers methods on `window.__antithesisTriage`. Call those methods with `agent-browser eval`.

Method call pattern:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getRunMetadata()"
```

`agent-browser eval` awaits Promises automatically, so async and sync methods
use the same call pattern.

**Error handling:** Runtime methods throw on error, which causes
`agent-browser eval` to return a non-zero exit code. Check the exit code
to detect failures — no output parsing required. The error message describes
what went wrong (e.g. wrong page, element not found, timeout).

If `window.__antithesisTriage` is missing, inject `assets/antithesis-triage.js` and retry the method call.

NEVER run `agent-browser` calls in parallel. They are stateful calls with side-effects, thus parallel calls can break or return confusing results.

## Navigation and loading

Each Antithesis page loads in content async. After navigation to any Antithesis page, follow this pattern:

First, wait for networkidle:

```sh
agent-browser --session "$SESSION" wait --load networkidle
```

Then, check the url to see if you got redirected to an authentication page:

```sh
agent-browser --session "$SESSION" get url
```

If you hit an authentication page, stop and reauthenticate before continuing.

Then, inject the runtime:

```bash
cat assets/antithesis-triage.js \
  | agent-browser --session "$SESSION" eval --stdin
```

Finally, eval the page-specific wait function to wait for all asynchronous chunks to finish loading:

- Report page: `window.__antithesisTriage.report.waitForReady()`
- Logs page: `window.__antithesisTriage.logs.waitForReady()`
- Runs page: `window.__antithesisTriage.runs.waitForReady()`

Each wait method polls for up to 60 seconds by default. On success it
returns `{ attempts, waitedMs }`. On timeout, the method **throws** causing
`agent-browser eval` to return a non-zero exit code.

Use the lower-level boolean checks when you need a one-shot probe:

- Report page: `window.__antithesisTriage.report.loadingFinished()`
- Logs page: `window.__antithesisTriage.logs.loadingFinished()`
- Runs page: `window.__antithesisTriage.runs.loadingFinished()`

If the report page still does not become ready, inspect status:

- Report page: `window.__antithesisTriage.report.loadingStatus()`
- Logs page: `window.__antithesisTriage.logs.loadingStatus()`
- Runs page: `window.__antithesisTriage.runs.loadingStatus()`

## Handling error reports

After every report `waitForReady()` call, check `result.error`. If it is
present, read `references/error-reports.md` for the error report workflow.

## Workflows

### Summarize recent runs

Read `references/run-discovery.md` to get a list of recent runs. Then summarize them in a report.

### Looking up a specific run

To lookup a specific run (report), read `references/run-discovery.md`. Then continue with other workflows as needed.

Make sure NOT to filter by text or status unless explicitly asked. If you are trying to find the most recent run for a project, just look at recent runs with any status first. Only filter by text or status if you can't find what you are looking for.

### Triage a run

1. Read `references/run-info.md` to load information on a run
2. Read `references/properties.md` to load properties
3. Cross reference failed properties with findings, review passed/failed counts
4. Build a detailed summary of the run including a review of all failures as well as flagging any new failures.

### Investigate failed properties

1. Read `references/properties.md` - use `getPropertyExamples()` to extract properties with their examples and learn how to download logs
2. Read `references/logs.md` to learn how to understand logs
3. For each property to investigate:
   a. Pick the first failing example
   b. Call `getExampleLogsUrl(propertyName, index)` to get the example's log URL
   c. Download the example's log using `download-logs.sh`
   d. Analyze the downloaded log locally
   e. If you aren't certain what caused the issue, consider downloading another example's log from the same property. Passing logs can be useful to compare against.
4. Cross-reference the log against the source code of the system under test (SUT) if you have access to it.
5. Deeply investigate the failure to develop an understanding of the timeline of events which led up to and potentially caused it.
6. Report your findings.

**Important:** Make sure you download and review example logs and the source code of the SUT if you have access to it. The property status and assertion text alone are not sufficient — the logs provide the actual runtime context needed to understand the failure.

### Verify cascade vs independent failures

When you suspect a failure might be a cascade from an earlier failure (e.g.,
property X always fails after property Y), do not rely on a handful of
examples from the triage report. A few examples can mislead — use the
`antithesis-query-logs` skill to test the hypothesis across all timelines:

1. Use `antithesis-query-logs` to count total failures of the target property
2. Run a temporal query ("not preceded by" the suspected upstream failure)
3. Compare counts: if the count drops, the difference is cascade failures;
   if it stays the same, the failures are independent
4. Report the actual numbers — e.g., "53 total failures, 53 remain after
   filtering out upstream-X → failures are independent" or "53 total, 7
   remain → 46 are cascades from upstream-X"

Do not generalize from a small sample. If you inspect 2-3 examples in the
triage log viewer and they all show the same upstream failure, that does not
mean all instances are cascades. The temporal query gives you the true count.

## General guidance

- **Always ensure you are authenticated first.**
- **Use disposable sessions.** Generate a unique `SESSION` for each triage run.
- **Inject the runtime after navigation.** After every `open`, after link clicks that may change pages, and after reopening the report from a finding route, wait until `networkidle`, inject `assets/antithesis-triage.js`, then use the matching `*.waitForReady()` method before continuing.
- **Never run `agent-browser` calls in parallel.**
- **Retry missing-runtime errors by reinjecting.** If a command fails because `window.__antithesisTriage` is undefined or missing, inject the runtime and rerun the same method.
- **Keep report evals on the main report view.** If you click into another page by accident, reopen the original report URL before using report queries again.
- **Download log files for local analysis.** Whenever possible try to download log files locally rather than using the web-ui log viewer.
- **Review logs before concluding on failures.** When a failed property has example rows with log links, download + analyze the logs before declaring a root cause. Some properties have no examples or logs — for those, the status alone is the evidence.
- **Prove cascade hypotheses with log queries, not samples.** If you suspect a failure is a cascade from an earlier failure, use the `antithesis-query-logs` skill's temporal queries to determine the true scope. Do not conclude from a few triage examples — the Logs Explorer searches all timelines and gives exact counts.
- **Present results clearly.** When reporting property statuses, use a table or list. When reporting log findings, include the virtual timestamp, source, container, and log text.

## Self-Review

Before declaring this skill complete, review your work against the criteria below. This skill's output is conversational (summaries, tables, analysis), so the review should happen in your current context. Re-read the guidance in this file, then systematically check each item below against the answers and analysis you produced.

Review criteria:

- Every property status reported (passed, failed, unfound) was extracted from the actual triage report, not inferred or assumed
- Findings reference specific data from the report — property names, assertion text, log lines, timestamps
- Failed properties with available logs include actionable context: the assertion text, relevant log lines, and timeline context. Conclusions about failures are grounded in log evidence when logs exist
- The summary distinguishes between what the report shows and what you interpret or recommend
- If comparing runs, differences are grounded in data from both reports, not just one
