---
name: antithesis-agent-browser
description: >
  Authenticate `agent-browser` against an Antithesis tenant and read data from Antithesis web pages (triage reports, runs page, logs viewer, causality reports). Only invoke this skill when explicitly requested by another skill or the user. Requires interactive browser authentication and is unsuitable for fully headless workflows.
compatibility: agent-browser (https://github.com/vercel-labs/agent-browser) and jq.
metadata:
  version: "2026-07-07 38a11c4"
---

# Antithesis agent-browser

A helper skill for reading data from authenticated Antithesis web pages
when the snouty API doesn't expose what's needed. Other skills
(`antithesis-triage`, `antithesis-debug`, `antithesis-query-logs`) delegate
here when they need an authenticated browser session.

## Purpose

- Handle interactive authentication to the user's Antithesis tenant with
  minimal disruption.
- Load Antithesis web pages (reports, logs, runs, causality) and extract
  data from them via an injected runtime.

## When to use

- When another skill needs information from an Antithesis page that snouty
  cannot reliably provide.
- When the user or another skill needs to interact with an Antithesis web
  page directly.

## Prerequisites

- DO NOT PROCEED if `agent-browser` is not installed. See `https://raw.githubusercontent.com/vercel-labs/agent-browser/refs/heads/main/README.md` for installation options.
- DO NOT PROCEED if `agent-browser` is older than version `v0.23.4`. You can upgrade with `agent-browser upgrade`.
- DO NOT PROCEED if `jq` is not installed. See `https://jqlang.org/download/` for installation options.

**Reference files:** This skill's `references/` directory contains detailed guides for specific tasks. Do NOT read them all up front — only read a reference file when you are told to. Each reference file is mentioned by name at the point where it is needed.

## General guidance

- **Always ensure you are authenticated first.**
- **Use disposable sessions.** Generate a unique `SESSION` for each invocation of this skill.
- **Inject the runtime after navigation.** After every `open`, after link clicks that may change pages, and after reopening a report from a finding route, wait until `networkidle`, inject `assets/antithesis-agent-browser.js`, then use the matching `*.waitForReady()` method before continuing.
- **Never run `agent-browser` calls in parallel.** They are stateful with side effects.
- **Retry missing-runtime errors by reinjecting.** If a command fails because `window.__antithesisAgentBrowser` is undefined or missing, inject the runtime and rerun the same method.
- **Keep report evals on the main report view.** If you click into another page by accident, reopen the original report URL before using report queries again.

## Session management with `agent-browser`

`agent-browser` has two session variables:

- `--session`: the name of a unique, isolated browser instance
- `--session-name`: auto-save/restore cookies by name

Every invocation MUST use a unique `--session` value. Generate it once and reuse it whenever you see `$SESSION` referenced by this skill.

```sh
SESSION=`antithesis-ab-$(date +%s)-$$`
```

Use `--session-name antithesis` on the FIRST `agent-browser` command that references a new `$SESSION`. This creates the session and restores saved cookies. Subsequent commands for the same `$SESSION` do not need `--session-name` — the session already exists.

Close the live session when done.

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

If the URL starts with `https://$TENANT.antithesis.com` then you are authenticated. If it redirected to a login page, you need to authenticate — read `references/setup-auth.md`, which gates the interactive headed login on user confirmation.

## Runtime injection

This skill ships a runtime (`assets/antithesis-agent-browser.js`) that exposes helper methods on `window.__antithesisAgentBrowser` for reading data from Antithesis pages. Inject it after navigation completes:

```bash
cat assets/antithesis-agent-browser.js \
  | agent-browser --session "$SESSION" eval --stdin
```

Call its methods with `agent-browser eval`:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisAgentBrowser.report.getRunMetadata()"
```

`agent-browser eval` awaits Promises automatically, so async and sync methods use the same call pattern.

**Error handling:** Runtime methods throw on error, which causes `agent-browser eval` to return a non-zero exit code. Check the exit code to detect failures — no output parsing required. The error message describes what went wrong (e.g. wrong page, element not found, timeout).

If `window.__antithesisAgentBrowser` is missing, reinject `assets/antithesis-agent-browser.js` and retry.

NEVER run `agent-browser` calls in parallel. They are stateful calls with side effects; parallel calls can break or return confusing results.

## Navigation and loading

Each Antithesis page loads content asynchronously. After navigation to any Antithesis page, follow this pattern:

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
cat assets/antithesis-agent-browser.js \
  | agent-browser --session "$SESSION" eval --stdin
```

Finally, eval the page-specific wait function to wait for all asynchronous chunks to finish loading:

- Report page: `window.__antithesisAgentBrowser.report.waitForReady()`
- Logs page: `window.__antithesisAgentBrowser.logs.waitForReady()`
- Runs page: `window.__antithesisAgentBrowser.runs.waitForReady()`

Each wait method polls for up to 60 seconds by default. On success it returns `{ attempts, waitedMs }`. On timeout, the method **throws** causing `agent-browser eval` to return a non-zero exit code.

Use the lower-level boolean checks when you need a one-shot probe:

- Report page: `window.__antithesisAgentBrowser.report.loadingFinished()`
- Logs page: `window.__antithesisAgentBrowser.logs.loadingFinished()`
- Runs page: `window.__antithesisAgentBrowser.runs.loadingFinished()`

If a page still does not become ready, inspect status:

- Report page: `window.__antithesisAgentBrowser.report.loadingStatus()`
- Logs page: `window.__antithesisAgentBrowser.logs.loadingStatus()`
- Runs page: `window.__antithesisAgentBrowser.runs.loadingStatus()`

## Handling error reports

After every report `waitForReady()` call, check `result.error`. If it is present, read `references/error-reports.md` for the error-report workflow.

## What this skill can do

1. **Authenticate to the tenant.** Read `references/setup-auth.md` for the interactive login flow.
2. **Discover runs from the runs page.** Read `references/run-discovery-ui.md`. Prefer `snouty runs list` whenever possible — only fall back to the UI when the API is unavailable or doesn't expose what you need.
3. **Read properties from a triage report.** Read `references/properties-from-ui.md`. Prefer `snouty runs --json properties` whenever possible.
4. **Look up a `run_id` from a triage-report URL** that cannot be matched against `snouty runs list`. The `run_id` is rendered at the bottom of the main report page (`report_id → run_id` is not currently exposed by the API).
5. **Download an error log from a failed run's report page.** See `references/error-reports.md`.
6. **Read a causality report.** Ask the user for the causality report URL. The main signal is the bug-probability trajectory in the logs leading up to the bug moment.
