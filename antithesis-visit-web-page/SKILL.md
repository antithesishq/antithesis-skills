---
name: antithesis-visit-web-page
description: >
  Instructions to authenticate to the tenant and read antithesis web pages. Specific cases where this skill is needed are: 
    1) Finding more examples of successes and failures for a property than what is provided in the property status 
    2) Performing log queries across all histories in an antithesis run, in combination with the log query skill. This answers questions such as "how often is failure X preceeded by an event Y".
    3) Interpreting the error log from a failed run
    4) Using multiverse debugging (MVD) sessions, 
    5) Interpreting Causality reports.
    6) Looking up the run_id when given only a triage-report URL that cannot be matched against the runs list (`report_id → run_id` is not currently exposed by the API).
    7) Looking up the session_id in order to launch a debug session with `snouty debug` by reading a triage report
  For cases not specifically listed here, using `snouty runs` is preferred to using this skill.
compatibility: agent-browser (https://github.com/vercel-labs/agent-browser) and jq.
metadata:
  version: "2026-05-05 1cd5f5a"
---

# Using agent-browser for antithesis web pages

## Purpose and Goal

Handle the authentication to the user's tenant with minimal disruption to the user's workflow.
Load antithesis web pages and extract data from them.

## When to Use

- When another skill requires information from an antithesis run that cannot be reliably
  provided by snouty. The snouty operation known to be incomplete and therefore unreliable is `snouty runs events`.
- When the user or another skill needs to interact with an antithesis web page or report.

## Prerequisites

- DO NOT PROCEED if `agent-browser` is not installed. See `https://raw.githubusercontent.com/vercel-labs/agent-browser/refs/heads/main/README.md` for installation options.
- DO NOT PROCEED if `agent-browser` is older than version `v0.23.4`. You can upgrade with `agent-browser upgrade`.
- DO NOT PROCEED if `jq` is not installed. See `https://jqlang.org/download/` for installation options.
- `agent-browser` installed and authenticated to the Antithesis tenant

**Reference files:** This skill's `references/` directory contains detailed guides for specific tasks. Do NOT read them all up front — only read a reference file when you are told to. Each reference file is mentioned by name at the point where it is needed.

## General guidance

- **Always ensure you are authenticated first.**
- **Use disposable sessions.** Generate a unique `SESSION` for each triage run.
- **Inject the runtime after navigation.** After every `open`, after link clicks that may change pages, and after reopening the report from a finding route, wait until `networkidle`, inject `assets/antithesis-triage.js`, then use the matching `*.waitForReady()` method before continuing.
- **Never run `agent-browser` calls in parallel.**
- **Retry missing-runtime errors by reinjecting.** If a command fails because `window.__antithesisTriage` is undefined or missing, inject the runtime and rerun the same method.
- **Keep report evals on the main report view.** If you click into another page by accident, reopen the original report URL before using report queries again.

## Session management with `agent-browser`

`agent-browser` has two session variables:

- `--session`: the name of an unique, isolated browser instance
- `--session-name`: auto-save/restore cookies by name

Every separate use MUST use a unique `--session` value. Generate this variable once per use and reuse it whenever you see `$SESSION` referenced by this skill.

```sh
SESSION=`antithesis-triage-$(date +%s)-$$`
```

Use `--session-name antithesis` on the FIRST `agent-browser` command that references a new `$SESSION`. This creates the session and restores saved cookies. Subsequent commands for the same `$SESSION` do not need `--session-name` — the session already exists.

Make sure you close the unique live session when the use is complete.

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

1) Finding more examples of successes and failures for a property than what is provided in the property status 

Use the `antithesis-query-logs` skill. Search for the propertythat you want more examples of by matching fields from the 
original propery. Make sure to set status to be either "passing" or "failing" depending on what you want.

2) Performing log queries across all histories in an antithesis run, in combination with the log query skill. This answers questions such as "how often is failure X preceeded by an event Y".

Use the `antithesis-query-logs` skill.

3) Interpreting the error log from a failed run

The triage report will contain an error log from the failed run. 

4) Using multiverse debugging (MVD) sessions

Use skill `antithesis-debug`.

5) Interpreting Causality reports.

You will need to ask the user for the URL for the causality report. The main information you will want is in the logs up to the
bug moment, which in the report are augmented with bug probabilities at that stage of the original run.

6) Looking up the run_id when given only a triage-report URL that cannot be matched against the runs list (`report_id → run_id` is not currently exposed by the API).

The run_id is at the bottom of the main triage page.

7) Looking up the session_id in order to launch a debug session with `snouty debug` by reading a triage report

If you are invoked to obtain the session_id for a run, load the triage report that matches the run_id,
which you can find with `snouty runs --json show ${RUN_ID}`. The session_id is at the bottom of the main
triage report page. Make sure the run_id is what you expect. 

## Handling runs discovery

`snouty runs list` is the preferred way to discover runs. If this skill is invoked as a fallback to discover runs, read `references/run-discovery-ui.md` for the runs discovery fallback workflow.



